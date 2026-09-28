// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

interface IRUSD {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title RuleXEscrowV2
 * @notice Educational Sepolia milestone escrow with milestone deadlines,
 *         a client review window, disputes, timeout protection for freelancers,
 *         and atomic final-delivery reveal + payment claim.
 *
 * IMPORTANT:
 * - Testnet prototype only.
 * - Not audited.
 * - The contract cannot execute by itself when time passes. After a review
 *   deadline expires, the freelancer calls claimTimedOutMilestone() to make
 *   the milestone approved, then revealDeliveryAndClaim() to receive payment.
 */
contract RuleXEscrowV2 {
    IRUSD public paymentToken;
    address public owner;
    address public arbiter;
    uint256 public projectCount;
    uint256 public constant REVIEW_PERIOD = 3 days;

    bool private locked;

    enum ProjectStatus {
        Created,
        Accepted,
        Funded,
        Completed,
        CancelPending,
        Cancelled
    }

    struct Milestone {
        string description;
        uint256 amount;
        uint256 deadline;

        bool submitted;
        string proof;
        uint256 submittedAt;
        uint256 reviewDeadline;

        bool approved;
        bool disputed;
        string disputeReason;

        bool paid;
        bool refunded;
        string finalDelivery;
    }

    struct Project {
        uint256 id;
        address client;
        address freelancer;
        string title;
        string projectDescription;
        uint256 totalAmount;
        uint256 escrowBalance;
        uint256 currentMilestone;
        ProjectStatus status;
        bool clientCancellationApproved;
        bool freelancerCancellationApproved;
    }

    mapping(uint256 => Project) public projects;
    mapping(uint256 => Milestone[]) private projectMilestones;

    event ProjectCreated(uint256 indexed projectId, address indexed client, address indexed freelancer, uint256 totalAmount);
    event ProjectAccepted(uint256 indexed projectId, address indexed freelancer);
    event ProjectFunded(uint256 indexed projectId, uint256 amount);
    event MilestoneDeadlineUpdated(uint256 indexed projectId, uint256 indexed milestoneIndex, uint256 deadline);
    event MilestoneSubmitted(uint256 indexed projectId, uint256 indexed milestoneIndex, string proof, uint256 reviewDeadline);
    event MilestoneApproved(uint256 indexed projectId, uint256 indexed milestoneIndex, address indexed approvedBy);
    event MilestoneDisputed(uint256 indexed projectId, uint256 indexed milestoneIndex, string reason);
    event DisputeResolved(uint256 indexed projectId, uint256 indexed milestoneIndex, bool freelancerWins);
    event MilestonePaid(uint256 indexed projectId, uint256 indexed milestoneIndex, uint256 amount, string finalDelivery);
    event MilestoneRefunded(uint256 indexed projectId, uint256 indexed milestoneIndex, uint256 amount);
    event CancellationRequested(uint256 indexed projectId, address indexed requestedBy);
    event ProjectCancelled(uint256 indexed projectId, uint256 refundedAmount);
    event ProjectCompleted(uint256 indexed projectId);
    event ArbiterUpdated(address indexed oldArbiter, address indexed newArbiter);

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Only arbiter");
        _;
    }

    modifier projectExists(uint256 projectId) {
        require(projectId > 0 && projectId <= projectCount, "Project does not exist");
        _;
    }

    constructor(address tokenAddress) {
        require(tokenAddress != address(0), "Invalid token");
        paymentToken = IRUSD(tokenAddress);
        owner = msg.sender;
        arbiter = msg.sender;
    }

    function version() external pure returns (uint256) {
        return 2;
    }

    function setArbiter(address newArbiter) external onlyOwner {
        require(newArbiter != address(0), "Invalid arbiter");
        address old = arbiter;
        arbiter = newArbiter;
        emit ArbiterUpdated(old, newArbiter);
    }

    function createProject(
        address freelancer,
        string calldata title,
        string calldata projectDescription,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestoneAmounts,
        uint256[] calldata milestoneDeadlines
    ) external returns (uint256) {
        require(freelancer != address(0), "Invalid freelancer");
        require(freelancer != msg.sender, "Client and freelancer must differ");
        require(milestoneDescriptions.length >= 1 && milestoneDescriptions.length <= 3, "Use 1 to 3 milestones");
        require(milestoneDescriptions.length == milestoneAmounts.length, "Milestone arrays mismatch");
        require(milestoneDescriptions.length == milestoneDeadlines.length, "Deadline arrays mismatch");

        uint256 total;
        uint256 previousDeadline;

        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            require(milestoneAmounts[i] > 0, "Milestone amount must exceed 0");
            require(milestoneDeadlines[i] > block.timestamp, "Deadline must be in future");
            if (i > 0) {
                require(milestoneDeadlines[i] > previousDeadline, "Deadlines must increase");
            }
            previousDeadline = milestoneDeadlines[i];
            total += milestoneAmounts[i];
        }

        projectCount++;
        uint256 projectId = projectCount;

        projects[projectId] = Project({
            id: projectId,
            client: msg.sender,
            freelancer: freelancer,
            title: title,
            projectDescription: projectDescription,
            totalAmount: total,
            escrowBalance: 0,
            currentMilestone: 0,
            status: ProjectStatus.Created,
            clientCancellationApproved: false,
            freelancerCancellationApproved: false
        });

        for (uint256 i = 0; i < milestoneDescriptions.length; i++) {
            projectMilestones[projectId].push(Milestone({
                description: milestoneDescriptions[i],
                amount: milestoneAmounts[i],
                deadline: milestoneDeadlines[i],
                submitted: false,
                proof: "",
                submittedAt: 0,
                reviewDeadline: 0,
                approved: false,
                disputed: false,
                disputeReason: "",
                paid: false,
                refunded: false,
                finalDelivery: ""
            }));
        }

        emit ProjectCreated(projectId, msg.sender, freelancer, total);
        return projectId;
    }

    /**
     * Client may adjust a milestone deadline before the project is funded.
     * This avoids trapping the freelancer with a stale date if acceptance takes time.
     */
    function updateMilestoneDeadline(
        uint256 projectId,
        uint256 milestoneIndex,
        uint256 newDeadline
    ) external projectExists(projectId) {
        Project storage project = projects[projectId];
        require(msg.sender == project.client, "Only client");
        require(
            project.status == ProjectStatus.Created || project.status == ProjectStatus.Accepted,
            "Deadline locked after funding"
        );
        require(milestoneIndex < projectMilestones[projectId].length, "Invalid milestone");
        require(newDeadline > block.timestamp, "Deadline must be in future");

        if (milestoneIndex > 0) {
            require(newDeadline > projectMilestones[projectId][milestoneIndex - 1].deadline, "Must follow prior deadline");
        }
        if (milestoneIndex + 1 < projectMilestones[projectId].length) {
            require(newDeadline < projectMilestones[projectId][milestoneIndex + 1].deadline, "Must precede next deadline");
        }

        projectMilestones[projectId][milestoneIndex].deadline = newDeadline;
        emit MilestoneDeadlineUpdated(projectId, milestoneIndex, newDeadline);
    }

    function acceptProject(uint256 projectId) external projectExists(projectId) {
        Project storage project = projects[projectId];
        require(msg.sender == project.freelancer, "Only freelancer");
        require(project.status == ProjectStatus.Created, "Wrong project status");
        project.status = ProjectStatus.Accepted;
        emit ProjectAccepted(projectId, msg.sender);
    }

    function fundProject(uint256 projectId) external nonReentrant projectExists(projectId) {
        Project storage project = projects[projectId];
        require(msg.sender == project.client, "Only client");
        require(project.status == ProjectStatus.Accepted, "Freelancer must accept first");

        uint256 amount = project.totalAmount;
        require(paymentToken.transferFrom(msg.sender, address(this), amount), "Token transfer failed");

        project.escrowBalance = amount;
        project.status = ProjectStatus.Funded;
        emit ProjectFunded(projectId, amount);
    }

    /**
     * Freelancer submits proof/preview, not the protected final deliverable.
     * Client receives REVIEW_PERIOD to approve or dispute.
     */
    function submitMilestone(
        uint256 projectId,
        string calldata proof
    ) external projectExists(projectId) {
        Project storage project = projects[projectId];
        require(msg.sender == project.freelancer, "Only freelancer");
        require(project.status == ProjectStatus.Funded, "Project not active");
        require(bytes(proof).length > 0, "Proof required");

        uint256 index = project.currentMilestone;
        require(index < projectMilestones[projectId].length, "No milestone remaining");

        Milestone storage milestone = projectMilestones[projectId][index];
        require(!milestone.submitted, "Already submitted");
        require(!milestone.paid && !milestone.refunded, "Milestone resolved");
        require(block.timestamp <= milestone.deadline, "Milestone deadline missed");

        milestone.submitted = true;
        milestone.proof = proof;
        milestone.submittedAt = block.timestamp;
        milestone.reviewDeadline = block.timestamp + REVIEW_PERIOD;

        emit MilestoneSubmitted(projectId, index, proof, milestone.reviewDeadline);
    }

    /**
     * Client approves the proof. Payment is NOT transferred yet.
     * The freelancer must reveal the protected final delivery and claim payment.
     */
    function approveMilestone(uint256 projectId) external projectExists(projectId) {
        Project storage project = projects[projectId];
        require(msg.sender == project.client, "Only client");
        require(project.status == ProjectStatus.Funded, "Project not active");

        uint256 index = project.currentMilestone;
        require(index < projectMilestones[projectId].length, "No milestone");
        Milestone storage milestone = projectMilestones[projectId][index];

        require(milestone.submitted, "Work not submitted");
        require(!milestone.disputed, "Milestone disputed");
        require(!milestone.approved, "Already approved");
        require(!milestone.paid && !milestone.refunded, "Milestone resolved");

        milestone.approved = true;
        emit MilestoneApproved(projectId, index, msg.sender);
    }

    /**
     * If the client does nothing for 3 days after submission, the freelancer
     * can make the milestone approved on-chain. This prevents indefinite delay.
     */
    function claimTimedOutMilestone(uint256 projectId) external projectExists(projectId) {
        Project storage project = projects[projectId];
        require(msg.sender == project.freelancer, "Only freelancer");
        require(project.status == ProjectStatus.Funded, "Project not active");

        uint256 index = project.currentMilestone;
        require(index < projectMilestones[projectId].length, "No milestone");
        Milestone storage milestone = projectMilestones[projectId][index];

        require(milestone.submitted, "Work not submitted");
        require(!milestone.disputed, "Milestone disputed");
        require(!milestone.approved, "Already approved");
        require(block.timestamp > milestone.reviewDeadline, "Review period active");

        milestone.approved = true;
        emit MilestoneApproved(projectId, index, msg.sender);
    }

    /**
     * Client can dispute during the review window. Funds remain locked until
     * the arbiter resolves the milestone.
     */
    function raiseDispute(
        uint256 projectId,
        string calldata reason
    ) external projectExists(projectId) {
        Project storage project = projects[projectId];
        require(msg.sender == project.client, "Only client");
        require(project.status == ProjectStatus.Funded, "Project not active");
        require(bytes(reason).length > 0, "Reason required");

        uint256 index = project.currentMilestone;
        require(index < projectMilestones[projectId].length, "No milestone");
        Milestone storage milestone = projectMilestones[projectId][index];

        require(milestone.submitted, "Work not submitted");
        require(!milestone.approved, "Already approved");
        require(!milestone.disputed, "Already disputed");
        require(!milestone.paid && !milestone.refunded, "Milestone resolved");
        require(block.timestamp <= milestone.reviewDeadline, "Review period ended");

        milestone.disputed = true;
        milestone.disputeReason = reason;

        emit MilestoneDisputed(projectId, index, reason);
    }

    /**
     * Demo arbitration. The deployer starts as arbiter and may be changed.
     * - freelancerWins=true: milestone becomes approved; freelancer still must
     *   reveal final delivery to claim payment.
     * - freelancerWins=false: milestone amount is refunded to the client.
     */
    function resolveDispute(
        uint256 projectId,
        bool freelancerWins
    ) external nonReentrant onlyArbiter projectExists(projectId) {
        Project storage project = projects[projectId];
        require(project.status == ProjectStatus.Funded, "Project not active");

        uint256 index = project.currentMilestone;
        require(index < projectMilestones[projectId].length, "No milestone");
        Milestone storage milestone = projectMilestones[projectId][index];

        require(milestone.disputed, "No active dispute");
        require(!milestone.paid && !milestone.refunded, "Milestone resolved");

        milestone.disputed = false;

        if (freelancerWins) {
            milestone.approved = true;
        } else {
            uint256 refund = milestone.amount;
            require(project.escrowBalance >= refund, "Insufficient escrow");

            milestone.refunded = true;
            project.escrowBalance -= refund;
            project.currentMilestone++;

            require(paymentToken.transfer(project.client, refund), "Refund failed");
            emit MilestoneRefunded(projectId, index, refund);

            _completeIfFinished(projectId);
        }

        emit DisputeResolved(projectId, index, freelancerWins);
    }

    /**
     * Atomic protected-delivery handoff:
     * the final delivery string is written on-chain in the same transaction
     * that releases the milestone payment.
     */
    function revealDeliveryAndClaim(
        uint256 projectId,
        string calldata finalDelivery
    ) external nonReentrant projectExists(projectId) {
        Project storage project = projects[projectId];
        require(msg.sender == project.freelancer, "Only freelancer");
        require(project.status == ProjectStatus.Funded, "Project not active");
        require(bytes(finalDelivery).length > 0, "Final delivery required");

        uint256 index = project.currentMilestone;
        require(index < projectMilestones[projectId].length, "No milestone");
        Milestone storage milestone = projectMilestones[projectId][index];

        require(milestone.submitted, "Work not submitted");
        require(milestone.approved, "Milestone not approved");
        require(!milestone.disputed, "Milestone disputed");
        require(!milestone.paid && !milestone.refunded, "Milestone resolved");

        uint256 payment = milestone.amount;
        require(project.escrowBalance >= payment, "Insufficient escrow");

        milestone.finalDelivery = finalDelivery;
        milestone.paid = true;

        project.escrowBalance -= payment;
        project.currentMilestone++;

        require(paymentToken.transfer(project.freelancer, payment), "Payment failed");

        emit MilestonePaid(projectId, index, payment, finalDelivery);
        _completeIfFinished(projectId);
    }

    /**
     * If the freelancer misses the active milestone deadline and has not
     * submitted proof, the client may cancel and recover remaining escrow.
     */
    function cancelForMissedDeadline(uint256 projectId) external nonReentrant projectExists(projectId) {
        Project storage project = projects[projectId];
        require(msg.sender == project.client, "Only client");
        require(project.status == ProjectStatus.Funded, "Project not active");

        uint256 index = project.currentMilestone;
        require(index < projectMilestones[projectId].length, "No milestone");
        Milestone storage milestone = projectMilestones[projectId][index];

        require(!milestone.submitted, "Work already submitted");
        require(block.timestamp > milestone.deadline, "Milestone deadline active");

        _cancelProject(projectId);
    }

    function requestCancellation(uint256 projectId) external projectExists(projectId) {
        Project storage project = projects[projectId];

        require(msg.sender == project.client || msg.sender == project.freelancer, "Not project participant");
        require(
            project.status == ProjectStatus.Accepted ||
            project.status == ProjectStatus.Funded ||
            project.status == ProjectStatus.CancelPending,
            "Cannot cancel"
        );

        if (msg.sender == project.client) {
            project.clientCancellationApproved = true;
        } else {
            project.freelancerCancellationApproved = true;
        }

        project.status = ProjectStatus.CancelPending;
        emit CancellationRequested(projectId, msg.sender);

        if (project.clientCancellationApproved && project.freelancerCancellationApproved) {
            _cancelProject(projectId);
        }
    }

    function _cancelProject(uint256 projectId) internal {
        Project storage project = projects[projectId];
        uint256 refund = project.escrowBalance;

        project.escrowBalance = 0;
        project.status = ProjectStatus.Cancelled;

        if (refund > 0) {
            require(paymentToken.transfer(project.client, refund), "Refund failed");
        }

        emit ProjectCancelled(projectId, refund);
    }

    function _completeIfFinished(uint256 projectId) internal {
        Project storage project = projects[projectId];

        if (project.currentMilestone == projectMilestones[projectId].length) {
            project.status = ProjectStatus.Completed;
            emit ProjectCompleted(projectId);
        }
    }

    function getMilestoneCount(uint256 projectId)
        external
        view
        projectExists(projectId)
        returns (uint256)
    {
        return projectMilestones[projectId].length;
    }

    function getMilestone(uint256 projectId, uint256 milestoneIndex)
        external
        view
        projectExists(projectId)
        returns (
            string memory description,
            uint256 amount,
            uint256 deadline,
            bool submitted,
            string memory proof,
            uint256 submittedAt,
            uint256 reviewDeadline,
            bool approved,
            bool disputed,
            string memory disputeReason,
            bool paid,
            bool refunded,
            string memory finalDelivery
        )
    {
        require(milestoneIndex < projectMilestones[projectId].length, "Invalid milestone");

        Milestone memory milestone = projectMilestones[projectId][milestoneIndex];

        return (
            milestone.description,
            milestone.amount,
            milestone.deadline,
            milestone.submitted,
            milestone.proof,
            milestone.submittedAt,
            milestone.reviewDeadline,
            milestone.approved,
            milestone.disputed,
            milestone.disputeReason,
            milestone.paid,
            milestone.refunded,
            milestone.finalDelivery
        );
    }
}
