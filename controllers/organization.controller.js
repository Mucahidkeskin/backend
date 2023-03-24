import {
  Organization,
  OrganizationMembers,
  Invite,
} from "../models/organization.model.js";
import { User } from "../models/user.model.js";
import { v4 as uuidv4 } from "uuid";
import sgMail from "@sendgrid/mail";
import envConfig from "../config/env.config.js";

/*
 * Create an organization.
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<Response>}
 */
export async function createOrganization(req, res) {
  const { name, description } = req.body;
  try {
    // Create the organization.
    const newOrganization = await Organization.create({
      name,
      description,
    });

    // Add the owner to the organization with the 'owner' role.
    await OrganizationMembers.create({
      organizationId: newOrganization.id,
      userId: req.user.id,
      role: "owner",
    });

    // Return success message.
    return res.json({
      success: true,
      message: "Organization created successfully",
      data: newOrganization,
    });
  } catch (error) {
    // Return error message.
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/*
  * Delete an organization.
  * @param {Request} req
  * @param {Response} res
  * @returns {Promise<Response>}
  * Only the 'owner' of the organization can delete the organization.
  TODO: Add mail approval for deleting the organization.
*/
export async function deleteOrganization(req, res) {
  const organizationId = req.params["id"];
  const userId = req.user.id;
  try {
    // Authorization check
    const organizationMember = await OrganizationMembers.findOne({
      where: {
        userId,
        organizationId,
      },
    });

    if (!organizationMember || organizationMember.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "You are unauthorized.",
      });
    }

    // Find the organization by primary key.
    const organization = await Organization.findByPk(organizationId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Delete the organization.
    await organization.destroy();
    return res.json({
      message: "Organization deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

/*
 * Update an organization.
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<Response>}
 * Only the 'owner' of the organization can update the organization.
 */
export async function updateOrganization(req, res) {
  // Get the name and description from the request body.
  const { name, description } = req.body;
  const userId = req.user.id;
  // Get the organization id from the request parameters.
  const organizationId = req.params["id"];
  try {
    // Authorization check
    const organizationMember = await OrganizationMembers.findOne({
      where: {
        userId,
        organizationId,
      },
    });

    if (!organizationMember || organizationMember.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "You are unauthorized.",
      });
    }

    // Find the organization by primary key.
    const organization = await Organization.findByPk(organizationId);
    if (!organization) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }
    // Update the organization.
    await organization.update({
      name,
      description,
    });
    return res.json({
      success: true,
      message: "Organization updated successfully",
      data: organization,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/*
 * Get organizations.
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<Response>}
 * Get current user's all organizations.
 */
export async function getOrganizations(req, res) {
  // Get the user id from the request object.
  const userId = req.user.id;
  try {
    // Find all organizations where the user is a member.
    const organizations = await OrganizationMembers.findAll({
      where: {
        userId,
      },
      include: {
        model: Organization,
        attributes: ["id", "name", "description"],
      },
    });

    return res.json({
      success: true,
      message: "Organizations fetched successfully",
      data: organizations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/*
 * Get organization members.
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<Response>}
 * Organization members can view the members of the organization.
 */
export async function getOrganizationMembers(req, res) {
  const organizationId = req.params["id"];
  const userId = req.user.id;
  try {
    // Authorization check.
    const organizationMember = await OrganizationMembers.findOne({
      where: {
        userId,
        organizationId,
      },
    });

    if (!organizationMember) {
      return res.status(403).json({
        success: false,
        message: "You are unauthorized to perform this action.",
      });
    }
    // Find all users where the user is a member of the organization.
    const organizationMembers = await OrganizationMembers.findAll({
      where: {
        organizationId,
      },
      include: {
        model: User,
        attributes: ["id", "name", "email"],
      },
    });
    return res.json({
      success: true,
      message: "Organization members fetched successfully",
      data: organizationMembers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/*
 * Invite user to organization.
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<Response>}
 * Only the 'owner' of the organization can invite a user to the organization.
 */
export async function inviteUserToOrganization(req, res) {
  const { email } = req.body;
  const organizationId = req.params["id"];

  const userId = req.user.id;

  try {
    // Authorization check.
    const currentUser = await OrganizationMembers.findOne({
      where: {
        organizationId,
        userId,
      },
    });

    if (!currentUser || currentUser.role !== "owner") {
      return res.status(401).json({
        success: false,
        message: "You are unauthorized to perform this action.",
      });
    }

    // Find the user by email.
    const user = await User.findOne({
      where: {
        email,
      },
    });

    // If user not found, return error.
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User with this email not found in our records.",
      });
    }

    // Check if the user is already a member of the organization.
    const organizationMember = await OrganizationMembers.findOne({
      where: {
        organizationId,
        userId: user.id,
      },
    });

    // If user is already a member, return error.
    if (organizationMember) {
      return res.status(400).json({
        success: false,
        message: "User is already a member of the organization",
      });
    }

    const secret = uuidv4();
    const invite = await Invite.create({
      organizationId,
      email: email,
      userId: user.id,
      secret: secret,
    });

    sgMail.setApiKey(envConfig.SENDGRID_KEY);

    // Send Mail with the link to continue.
    const msg = {
      to: req.body.email, // Change to your recipient
      from: "mertplayschess@outlook.com", // Change to your verified sender
      subject: "Project Genie Organization Invitation",
      text:
        "Someone invited you to their organization! See the link below to accept or reject the organization: \n" +
        "http://localhost:3000/organizations/invite?secret=" +
        secret +
        "&email=" +
        req.body.email,
      html:
        "Someone invited you to their organization! See the link below to accept or reject the organization: \n" +
        "http://localhost:3000/organizations/invite?secret=" +
        secret +
        "&email=" +
        req.body.email,
    };

    sgMail
      .send(msg)
      .then(() => {
        console.log("Email sent");
      })
      .catch((error) => {
        console.error(error);
      });

    return res.json({
      success: true,
      message: "User invited successfully",
      data: invite,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/*
 * Accept an invitation.
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<Response>}
 * User can accept an invitation to an organization.
 */
export async function acceptInvitation(req, res) {
  const { secret } = req.body;
  const userId = req.user.id;
  try {
    const invite = await Invite.findOne({
      where: {
        secret,
        userId,
      },
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: "Invite not found",
      });
    }

    const organizationMember = await OrganizationMembers.create({
      organizationId: invite.organizationId,
      userId: invite.userId,
      role: "member",
    });

    await invite.destroy();

    return res.json({
      success: true,
      message: "Invite accepted successfully.",
      data: organizationMember,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/*
 * Reject an invitation.
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<Response>}
 * User can reject an invitation to an organization.
 */
export async function rejectInvitation(req, res) {
  const { secret } = req.body;
  const userId = req.user.id;
  try {
    const invite = await Invite.findOne({
      where: {
        secret,
        userId,
      },
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: "Invite not found",
      });
    }

    await invite.destroy();

    return res.json({
      success: true,
      message: "Invite rejected successfully.",
      data: organizationMember,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/*
 * Remove a member from an organization.
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<Response>}
 * Only the 'owner' of the organization can remove a member from the organization.
 * The owner cannot remove themselves from the organization.
 * The owner cannot remove another owner from the organization.
 * The owner cannot remove the last owner from the organization.
 */
export async function removeOrganizationMember(req, res) {
  const organizationId = req.params["id"];
  const { userId } = req.body;
  const currentUserId = req.user.id;

  try {
    // Authorization check.
    const currentUser = await OrganizationMembers.findOne({
      where: {
        organizationId,
        userId: currentUserId,
      },
    });

    if (!currentUser || currentUser.role !== "owner") {
      return res.status(401).json({
        success: false,
        message: "You are unauthorized to perform this action.",
      });
    }

    // Check if the user is a member of the organization.
    const organizationMember = await OrganizationMembers.findOne({
      where: {
        organizationId,
        userId,
      },
    });

    // If user is not a member, return error.
    if (!organizationMember) {
      return res.status(400).json({
        success: false,
        message: "User is not a member of the organization",
      });
    }

    // Check if the user is the owner of the organization.
    if (organizationMember.role === "owner") {
      return res.status(400).json({
        success: false,
        message: "You cannot remove an owner of the organization.",
      });
    }

    // Check if the user is the last owner of the organization.
    const owners = await OrganizationMembers.findAll({
      where: {
        organizationId,
        role: "owner",
      },
    });

    if (owners.length === 1) {
      return res.status(400).json({
        success: false,
        message: "You cannot remove the last owner of the organization.",
      });
    }

    await organizationMember.destroy();

    return res.json({
      success: true,
      message: "User removed from the organization successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/*
 * Update a member's role in an organization.
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<Response>}
 * Only the 'owner' of the organization can update a member's role in the organization.
 */
export async function updateOrganizationMember(req, res) {
  const organizationId = req.params["id"];
  const { userId, role } = req.body;
  const currentUserId = req.user.id;
  try {
    const currentUser = await OrganizationMembers.findOne({
      where: {
        organizationId,
        userId: currentUserId,
      },
    });

    if (!currentUser || currentUser.role !== "owner") {
      return res.status(401).json({
        success: false,
        message: "You are unauthorized to perform this action.",
      });
    }

    const organizationMember = await OrganizationMembers.findOne({
      where: {
        organizationId,
        userId,
      },
    });

    if (!organizationMember) {
      return res.status(400).json({
        success: false,
        message: "User is not a member of the organization",
      });
    }

    await organizationMember.update({
      role,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/*
 * Get Current User of organization.
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<Response>}
 */
export async function getCurrentUserOrganization(req, res) {
  // get organization id from parameters
  const organizationId = req.params["id"];

  const userId = req.user.id;

  try {
    const organizationMember = await OrganizationMembers.findOne({
      where: {
        userId: userId,
        organizationId: organizationId,
      },
    });

    if (!organizationMember) {
      return res.status(404).send({
        success: false,
        message: "Organization member not found.",
      });
    }

    return res.send({
      success: true,
      message: "Organization member found.",
      data: organizationMember,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message:
        error.message ||
        "Some error occurred while retrieving organization member.",
    });
  }
}
