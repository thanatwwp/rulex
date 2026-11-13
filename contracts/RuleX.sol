// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/*
============================================================
                      MOCK TOKEN
============================================================

Educational ERC-20-style token for RuleX Sepolia demo.

RUSD = RuleX USD

This token has NO real monetary value.
*/

contract MockRUSD {

    string public name = "RuleX USD";
    string public symbol = "RUSD";

    uint8 public constant decimals = 18;

    uint256 public totalSupply;

    address public owner;

    mapping(address => uint256) public balanceOf;

    mapping(address => mapping(address => uint256))
        public allowance;


    event Transfer(
        address indexed from,
        address indexed to,
        uint256 value
    );

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );


    modifier onlyOwner() {

        require(
            msg.sender == owner,
            "Only owner"
        );

        _;
    }


    constructor(uint256 initialSupply) {

        owner = msg.sender;

        _mint(
            msg.sender,
            initialSupply * 10 ** decimals
        );
    }


    function _mint(
        address to,
        uint256 amount
    )
        internal
    {

        require(
            to != address(0),
            "Invalid address"
        );

        totalSupply += amount;

        balanceOf[to] += amount;

        emit Transfer(
            address(0),
            to,
            amount
        );
    }


    function mint(
        address to,
        uint256 amount
    )
        external
        onlyOwner
    {

        _mint(
            to,
            amount * 10 ** decimals
        );
    }


    function transfer(
        address to,
        uint256 amount
    )
        external
        returns (bool)
    {

        _transfer(
            msg.sender,
            to,
            amount
        );

        return true;
    }


    function approve(
        address spender,
        uint256 amount
    )
        external
        returns (bool)
    {

        allowance[msg.sender][spender] =
            amount;

        emit Approval(
            msg.sender,
            spender,
            amount
        );

        return true;
    }


    function transferFrom(
        address from,
        address to,
        uint256 amount
    )
        external
        returns (bool)
    {

        uint256 currentAllowance =
            allowance[from][msg.sender];

        require(
            currentAllowance >= amount,
            "Allowance too low"
        );


        if (
            currentAllowance
            !=
            type(uint256).max
        ) {

            allowance[from][msg.sender]
                =
                currentAllowance - amount;
        }


        _transfer(
            from,
            to,
            amount
        );

        return true;
    }


    function _transfer(
        address from,
        address to,
        uint256 amount
    )
        internal
    {

        require(
            to != address(0),
            "Invalid address"
        );

        require(
            balanceOf[from] >= amount,
            "Balance too low"
        );


        balanceOf[from] -= amount;

        balanceOf[to] += amount;


        emit Transfer(
            from,
            to,
            amount
        );
    }
}



/*
============================================================
                    RULEX ESCROW
============================================================
*/

contract RuleXEscrow {

    MockRUSD public paymentToken;

    uint256 public projectCount;

    bool private locked;


    /*
    --------------------------------------------------------
                        PROJECT STATUS
    --------------------------------------------------------
    */

    enum ProjectStatus {

        Created,

        Accepted,

        Funded,

        Completed,

        CancelPending,

        Cancelled
    }


    /*
    --------------------------------------------------------
                         MILESTONE
    --------------------------------------------------------
    */

    struct Milestone {

        string description;

        uint256 amount;

        bool submitted;

        string submission;

        bool approved;

        bool paid;
    }


    /*
    --------------------------------------------------------
                          PROJECT
    --------------------------------------------------------
    */

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


    mapping(uint256 => Project)
        public projects;


    mapping(
        uint256 => Milestone[]
    )
        private projectMilestones;


    /*
    ========================================================
                            EVENTS
    ========================================================
    */


    event ProjectCreated(

        uint256 indexed projectId,

        address indexed client,

        address indexed freelancer,

        uint256 totalAmount
    );


    event ProjectAccepted(

        uint256 indexed projectId,

        address indexed freelancer
    );


    event ProjectFunded(

        uint256 indexed projectId,

        uint256 amount
    );


    event MilestoneSubmitted(

        uint256 indexed projectId,

        uint256 indexed milestoneIndex,

        string submission
    );


    event MilestoneApproved(

        uint256 indexed projectId,

        uint256 indexed milestoneIndex,

        uint256 amount
    );


    event CancellationRequested(

        uint256 indexed projectId,

        address indexed requestedBy
    );


    event ProjectCancelled(

        uint256 indexed projectId,

        uint256 refundedAmount
    );


    event ProjectCompleted(

        uint256 indexed projectId
    );


    /*
    ========================================================
                        MODIFIERS
    ========================================================
    */


    modifier nonReentrant() {

        require(
            !locked,
            "Reentrant call"
        );

        locked = true;

        _;

        locked = false;
    }


    modifier projectExists(
        uint256 projectId
    ) {

        require(
            projectId > 0
            &&
            projectId <= projectCount,
            "Project does not exist"
        );

        _;
    }


    /*
    ========================================================
                         CONSTRUCTOR
    ========================================================
    */


    constructor(
        address tokenAddress
    ) {

        require(
            tokenAddress != address(0),
            "Invalid token"
        );

        paymentToken =
            MockRUSD(tokenAddress);
    }


    /*
    ========================================================
                      CREATE PROJECT
    ========================================================
    */


    function createProject(

        address freelancer,

        string calldata title,

        string calldata projectDescription,

        string[] calldata milestoneDescriptions,

        uint256[] calldata milestoneAmounts

    )
        external
        returns (uint256)
    {

        require(
            freelancer != address(0),
            "Invalid freelancer"
        );


        require(
            freelancer != msg.sender,
            "Client and freelancer must differ"
        );


        require(
            milestoneDescriptions.length >= 1
            &&
            milestoneDescriptions.length <= 3,
            "Use 1 to 3 milestones"
        );


        require(
            milestoneDescriptions.length
            ==
            milestoneAmounts.length,
            "Milestone arrays mismatch"
        );


        uint256 total;


        for (
            uint256 i = 0;
            i < milestoneAmounts.length;
            i++
        ) {

            require(
                milestoneAmounts[i] > 0,
                "Milestone amount must exceed 0"
            );

            total +=
                milestoneAmounts[i];
        }


        projectCount++;


        uint256 projectId =
            projectCount;


        projects[projectId] =
            Project({

                id:
                    projectId,

                client:
                    msg.sender,

                freelancer:
                    freelancer,

                title:
                    title,

                projectDescription:
                    projectDescription,

                totalAmount:
                    total,

                escrowBalance:
                    0,

                currentMilestone:
                    0,

                status:
                    ProjectStatus.Created,

                clientCancellationApproved:
                    false,

                freelancerCancellationApproved:
                    false
            });


        for (
            uint256 i = 0;
            i < milestoneDescriptions.length;
            i++
        ) {

            projectMilestones[
                projectId
            ].push(

                Milestone({

                    description:
                        milestoneDescriptions[i],

                    amount:
                        milestoneAmounts[i],

                    submitted:
                        false,

                    submission:
                        "",

                    approved:
                        false,

                    paid:
                        false
                })
            );
        }


        emit ProjectCreated(

            projectId,

            msg.sender,

            freelancer,

            total
        );


        return projectId;
    }


    /*
    ========================================================
                     ACCEPT AGREEMENT
    ========================================================
    */


    function acceptProject(
        uint256 projectId
    )
        external
        projectExists(projectId)
    {

        Project storage project =
            projects[projectId];


        require(
            msg.sender
            ==
            project.freelancer,
            "Only freelancer"
        );


        require(
            project.status
            ==
            ProjectStatus.Created,
            "Wrong project status"
        );


        project.status =
            ProjectStatus.Accepted;


        emit ProjectAccepted(

            projectId,

            msg.sender
        );
    }


    /*
    ========================================================
                       FUND ESCROW
    ========================================================
    */


    function fundProject(
        uint256 projectId
    )
        external
        nonReentrant
        projectExists(projectId)
    {

        Project storage project =
            projects[projectId];


        require(
            msg.sender
            ==
            project.client,
            "Only client"
        );


        require(
            project.status
            ==
            ProjectStatus.Accepted,
            "Freelancer must accept first"
        );


        uint256 amount =
            project.totalAmount;


        require(

            paymentToken.transferFrom(

                msg.sender,

                address(this),

                amount
            ),

            "Token transfer failed"
        );


        project.escrowBalance =
            amount;


        project.status =
            ProjectStatus.Funded;


        emit ProjectFunded(

            projectId,

            amount
        );
    }


    /*
    ========================================================
                    SUBMIT MILESTONE
    ========================================================
    */


    function submitMilestone(

        uint256 projectId,

        string calldata submission

    )
        external
        projectExists(projectId)
    {

        Project storage project =
            projects[projectId];


        require(
            msg.sender
            ==
            project.freelancer,
            "Only freelancer"
        );


        require(
            project.status
            ==
            ProjectStatus.Funded,
            "Project not active"
        );


        require(
            bytes(submission).length > 0,
            "Submission required"
        );


        uint256 index =
            project.currentMilestone;


        require(
            index
            <
            projectMilestones[
                projectId
            ].length,
            "No milestone remaining"
        );


        Milestone storage milestone =
            projectMilestones[
                projectId
            ][index];


        require(
            !milestone.submitted,
            "Already submitted"
        );


        milestone.submitted =
            true;


        milestone.submission =
            submission;


        emit MilestoneSubmitted(

            projectId,

            index,

            submission
        );
    }


    /*
    ========================================================
                    APPROVE MILESTONE
    ========================================================
    */


    function approveMilestone(
        uint256 projectId
    )
        external
        nonReentrant
        projectExists(projectId)
    {

        Project storage project =
            projects[projectId];


        require(
            msg.sender
            ==
            project.client,
            "Only client"
        );


        require(
            project.status
            ==
            ProjectStatus.Funded,
            "Project not active"
        );


        uint256 index =
            project.currentMilestone;


        require(
            index
            <
            projectMilestones[
                projectId
            ].length,
            "No milestone"
        );


        Milestone storage milestone =
            projectMilestones[
                projectId
            ][index];


        require(
            milestone.submitted,
            "Work not submitted"
        );


        require(
            !milestone.paid,
            "Already paid"
        );


        uint256 payment =
            milestone.amount;


        require(
            project.escrowBalance
            >=
            payment,
            "Insufficient escrow"
        );


        /*
        Update state BEFORE transferring tokens.
        */

        milestone.approved =
            true;

        milestone.paid =
            true;


        project.escrowBalance -=
            payment;


        project.currentMilestone++;


        /*
        Release payment.
        */

        require(

            paymentToken.transfer(

                project.freelancer,

                payment
            ),

            "Payment failed"
        );


        emit MilestoneApproved(

            projectId,

            index,

            payment
        );


        /*
        Check whether all milestones are finished.
        */

        if (
            project.currentMilestone
            ==
            projectMilestones[
                projectId
            ].length
        ) {

            project.status =
                ProjectStatus.Completed;


            emit ProjectCompleted(
                projectId
            );
        }
    }


    /*
    ========================================================
                  MUTUAL CANCELLATION
    ========================================================
    */


    function requestCancellation(
        uint256 projectId
    )
        external
        projectExists(projectId)
    {

        Project storage project =
            projects[projectId];


        require(

            msg.sender
            ==
            project.client

            ||

            msg.sender
            ==
            project.freelancer,

            "Not project participant"
        );


        require(

            project.status
            ==
            ProjectStatus.Accepted

            ||

            project.status
            ==
            ProjectStatus.Funded

            ||

            project.status
            ==
            ProjectStatus.CancelPending,

            "Cannot cancel"
        );


        if (
            msg.sender
            ==
            project.client
        ) {

            project.clientCancellationApproved =
                true;

        } else {

            project.freelancerCancellationApproved =
                true;
        }


        project.status =
            ProjectStatus.CancelPending;


        emit CancellationRequested(

            projectId,

            msg.sender
        );


        /*
        If both participants agree,
        finalize the cancellation.
        */

        if (

            project.clientCancellationApproved

            &&

            project.freelancerCancellationApproved
        ) {

            _cancelProject(
                projectId
            );
        }
    }


    function _cancelProject(
        uint256 projectId
    )
        internal
    {

        Project storage project =
            projects[projectId];


        uint256 refund =
            project.escrowBalance;


        project.escrowBalance =
            0;


        project.status =
            ProjectStatus.Cancelled;


        if (
            refund > 0
        ) {

            require(

                paymentToken.transfer(

                    project.client,

                    refund
                ),

                "Refund failed"
            );
        }


        emit ProjectCancelled(

            projectId,

            refund
        );
    }


    /*
    ========================================================
                       VIEW FUNCTIONS
    ========================================================
    */


    function getMilestoneCount(
        uint256 projectId
    )
        external
        view
        projectExists(projectId)
        returns (uint256)
    {

        return
            projectMilestones[
                projectId
            ].length;
    }


    function getMilestone(

        uint256 projectId,

        uint256 milestoneIndex

    )
        external
        view
        projectExists(projectId)
        returns (

            string memory description,

            uint256 amount,

            bool submitted,

            string memory submission,

            bool approved,

            bool paid
        )
    {

        require(

            milestoneIndex
            <
            projectMilestones[
                projectId
            ].length,

            "Invalid milestone"
        );


        Milestone memory milestone =
            projectMilestones[
                projectId
            ][milestoneIndex];


        return (

            milestone.description,

            milestone.amount,

            milestone.submitted,

            milestone.submission,

            milestone.approved,

            milestone.paid
        );
    }
}
