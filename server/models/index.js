const User = require('./User');
const Lead = require('./Lead');
const LeadRemark = require('./LeadRemark');
const Followup = require('./Followup');
const Meeting = require('./Meeting');
const MeetingParticipant = require('./MeetingParticipant');
const Message = require('./Message');
const Notification = require('./Notification');
const Webinar = require('./Webinar');
const WebinarAttendee = require('./WebinarAttendee');
const WebinarCandidate = require('./WebinarCandidate');
const Group = require('./Group');
const GroupMember = require('./GroupMember');
const GroupMessage = require('./GroupMessage');
const GroupMessageRead = require('./GroupMessageRead');

// Lead ↔ User
Lead.belongsTo(User, { as: 'assignedTo', foreignKey: 'assignedToId' });
Lead.belongsTo(User, { as: 'assignedBy', foreignKey: 'assignedById' });
User.hasMany(Lead, { foreignKey: 'assignedToId' });

// LeadRemark ↔ Lead / User
Lead.hasMany(LeadRemark, { as: 'remarks', foreignKey: 'leadId' });
LeadRemark.belongsTo(Lead, { foreignKey: 'leadId' });
LeadRemark.belongsTo(User, { as: 'addedBy', foreignKey: 'addedById' });

// Followup ↔ Lead / User
Followup.belongsTo(Lead, { as: 'lead', foreignKey: 'leadId' });
Followup.belongsTo(User, { as: 'assignedTo', foreignKey: 'assignedToId' });
Followup.belongsTo(User, { as: 'assignedBy', foreignKey: 'assignedById' });
Followup.belongsTo(User, { as: 'completedBy', foreignKey: 'completedById' });
Lead.hasMany(Followup, { foreignKey: 'leadId' });

// Meeting ↔ User (organizer + participants M:M)
Meeting.belongsTo(User, { as: 'organizer', foreignKey: 'organizerId' });
Meeting.belongsToMany(User, { as: 'participants', through: MeetingParticipant, foreignKey: 'meetingId', otherKey: 'userId' });
User.belongsToMany(Meeting, { through: MeetingParticipant, foreignKey: 'userId', otherKey: 'meetingId' });

// Message ↔ User
Message.belongsTo(User, { as: 'from', foreignKey: 'fromId' });
Message.belongsTo(User, { as: 'to', foreignKey: 'toId' });

// Notification ↔ User / Lead / Followup
Notification.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Notification.belongsTo(Lead, { as: 'relatedLead', foreignKey: 'relatedLeadId' });
Notification.belongsTo(Followup, { as: 'relatedFollowup', foreignKey: 'relatedFollowupId' });

// Webinar ↔ User / WebinarAttendee / WebinarCandidate
Webinar.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });
Webinar.belongsToMany(User, { as: 'candidates', through: WebinarCandidate, foreignKey: 'webinarId', otherKey: 'userId' });
User.belongsToMany(Webinar, { through: WebinarCandidate, foreignKey: 'userId', otherKey: 'webinarId' });
Webinar.hasMany(WebinarAttendee, { as: 'attendees', foreignKey: 'webinarId' });
WebinarAttendee.belongsTo(Webinar, { foreignKey: 'webinarId' });
WebinarAttendee.belongsTo(Lead, { as: 'lead', foreignKey: 'leadId' });
WebinarAttendee.belongsTo(User, { as: 'markedBy', foreignKey: 'markedById' });

// Group ↔ User (creator + members M:M)
Group.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });
Group.belongsToMany(User, { as: 'members', through: GroupMember, foreignKey: 'groupId', otherKey: 'userId' });
User.belongsToMany(Group, { as: 'memberGroups', through: GroupMember, foreignKey: 'userId', otherKey: 'groupId' });

// GroupMessage ↔ Group / User / GroupMessageRead
GroupMessage.belongsTo(Group, { as: 'group', foreignKey: 'groupId' });
GroupMessage.belongsTo(User, { as: 'from', foreignKey: 'fromId' });
GroupMessage.belongsToMany(User, { as: 'readBy', through: GroupMessageRead, foreignKey: 'messageId', otherKey: 'userId' });
Group.hasMany(GroupMessage, { foreignKey: 'groupId' });

module.exports = {
  User, Lead, LeadRemark, Followup,
  Meeting, MeetingParticipant,
  Message, Notification,
  Webinar, WebinarAttendee, WebinarCandidate,
  Group, GroupMember, GroupMessage, GroupMessageRead
};
