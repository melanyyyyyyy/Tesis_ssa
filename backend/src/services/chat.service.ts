import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import type { Server } from 'socket.io';
import { ENV } from '../config/envs.js';
import {
    ConversationModel,
    MessageModel,
    NotificationModel,
    UserModel
} from '../models/system/index.js';
import {
    MatriculatedSubjectModel,
    StudentModel,
    SubjectModel
} from '../models/sigenu/index.js';

type DecodedSocketUser = {
    id: string;
    email?: string;
    role?: string;
    identification?: string;
};

const uniqueStrings = (values: Array<string | null | undefined>) => Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
);

const buildUserRoom = (userId: string) => `user:${userId}`;

const mapMessageSender = (sender: any) => ({
    _id: String(sender?._id || ''),
    firstName: sender?.firstName || '',
    lastName: sender?.lastName || '',
    email: sender?.email || ''
});

const mapMessage = (message: any) => ({
    _id: String(message?._id || ''),
    conversationId: String(message?.conversationId?._id || message?.conversationId || ''),
    content: message?.content || '',
    isRead: Boolean(message?.isRead),
    createdAt: message?.createdAt,
    updatedAt: message?.updatedAt,
    sender: mapMessageSender(message?.senderId)
});

const mapConversation = (conversation: any) => ({
    _id: String(conversation?._id || ''),
    subjectId: String(conversation?.subjectId || ''),
    kind: conversation?.kind || 'private',
    title: conversation?.title || 'Chat',
    participantCount: Array.isArray(conversation?.participants) ? conversation.participants.length : 0,
    studentId: conversation?.studentId ? String(conversation.studentId) : null,
    studentUserId: conversation?.studentUserId ? String(conversation.studentUserId) : null,
    hasLinkedUser: Boolean(conversation?.studentUserId),
    lastMessage: conversation?.lastMessage ? mapMessage(conversation.lastMessage) : null,
    updatedAt: conversation?.updatedAt
});

const buildProfessorChatLink = (params: {
    subjectId: string;
    conversationId: string;
    subjectName?: string;
    academicYear?: number;
}) => {
    const searchParams = new URLSearchParams({
        subjectId: params.subjectId,
        conversationId: params.conversationId
    });

    if (params.subjectName) {
        searchParams.set('subjectName', params.subjectName);
    }

    if (typeof params.academicYear === 'number') {
        searchParams.set('academicYear', String(params.academicYear));
    }

    return `/professor/chat?${searchParams.toString()}`;
};

let chatSocketServer: Server | null = null;

export const setChatSocketServer = (io: Server) => {
    chatSocketServer = io;

    io.use((socket, next) => {
        try {
            const token = String(socket.handshake.auth.token || socket.handshake.query.token || '');
            if (!token) {
                next(new Error('Authentication required.'));
                return;
            }

            const decoded = jwt.verify(token, ENV.JWT_SECRET) as DecodedSocketUser;
            socket.data.user = decoded;
            next();
        } catch (error) {
            next(error instanceof Error ? error : new Error('Invalid socket token.'));
        }
    });

    io.on('connection', (socket) => {
        const user = socket.data.user as DecodedSocketUser | undefined;
        if (!user?.id) {
            socket.disconnect(true);
            return;
        }

        socket.join(buildUserRoom(String(user.id)));
    });
};

const emitToConversationParticipants = (conversation: any, eventName: string, payload: unknown) => {
    if (!chatSocketServer) return;

    const participantIds = uniqueStrings(
        Array.isArray(conversation?.participants)
            ? conversation.participants.map((participant: any) => String(participant))
            : []
    );

    participantIds.forEach((participantId) => {
        chatSocketServer?.to(buildUserRoom(participantId)).emit(eventName, payload);
    });
};

const ensureProfessorSubject = async (subjectId: string, professorUserId: string) => {
    const subject = await SubjectModel.findOne({
        _id: subjectId,
        professorId: professorUserId
    })
        .select('_id name academicYear careerId professorId')
        .lean();

    if (!subject) {
        throw new Error('Asignatura no encontrada para el profesor autenticado.');
    }

    return subject;
};

const getEligibleStudentsForSubject = async (subject: any) => {
    const validStudents = await StudentModel.find({
        careerId: subject.careerId,
        academicYear: subject.academicYear
    })
        .select('_id firstName lastName')
        .lean();

    const validStudentIds = validStudents.map((student) => student._id);
    if (validStudentIds.length === 0) {
        return [];
    }

    const enrolledRows = await MatriculatedSubjectModel.find({
        subjectId: subject._id,
        academicYear: subject.academicYear,
        studentId: { $in: validStudentIds }
    })
        .select('studentId')
        .lean();

    const enrolledStudentIds = uniqueStrings(enrolledRows.map((row) => String(row.studentId)));
    if (enrolledStudentIds.length === 0) {
        return [];
    }

    const users = await UserModel.find({
        studentId: { $in: enrolledStudentIds }
    })
        .select('_id firstName lastName email studentId')
        .lean();

    const userByStudentId = new Map(
        users.map((user) => [String(user.studentId), user])
    );

    return validStudents
        .filter((student) => enrolledStudentIds.includes(String(student._id)))
        .map((student) => ({
            studentId: String(student._id),
            firstName: student.firstName || '',
            lastName: student.lastName || '',
            linkedUser: userByStudentId.get(String(student._id)) || null
        }));
};

const ensureGroupConversation = async (subject: any, professorUserId: string, eligibleStudents: any[]) => {
    const participants = uniqueStrings([
        professorUserId,
        ...eligibleStudents
            .map((student) => student.linkedUser?._id ? String(student.linkedUser._id) : null)
    ]).map((id) => new Types.ObjectId(id));

    return await ConversationModel.findOneAndUpdate(
        {
            subjectId: subject._id,
            kind: 'group'
        },
        {
            $set: {
                subjectId: subject._id,
                kind: 'group',
                title: subject.name,
                participants,
                studentId: null,
                studentUserId: null
            }
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );
};

const ensurePrivateConversation = async (subject: any, professorUserId: string, student: any) => {
    const participants = uniqueStrings([
        professorUserId,
        student.linkedUser?._id ? String(student.linkedUser._id) : null
    ]).map((id) => new Types.ObjectId(id));

    return await ConversationModel.findOneAndUpdate(
        {
            subjectId: subject._id,
            kind: 'private',
            studentId: new Types.ObjectId(student.studentId)
        },
        {
            $set: {
                subjectId: subject._id,
                kind: 'private',
                title: `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Estudiante',
                participants,
                studentId: new Types.ObjectId(student.studentId),
                studentUserId: student.linkedUser?._id ? new Types.ObjectId(String(student.linkedUser._id)) : null
            }
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );
};

const getAccessibleConversation = async (conversationId: string, userId: string) => {
    const conversation = await ConversationModel.findOne({
        _id: conversationId,
        participants: new Types.ObjectId(userId)
    }).lean();

    if (!conversation) {
        throw new Error('Conversación no encontrada o sin acceso.');
    }

    return conversation;
};

const createChatNotificationsForRecipients = async (params: {
    conversation: any;
    senderUserId: string;
    messageContent: string;
}) => {
    const subject = await SubjectModel.findById(params.conversation.subjectId)
        .select('_id name academicYear professorId')
        .lean();

    if (!subject) {
        return;
    }

    const senderUser = await UserModel.findById(params.senderUserId)
        .select('firstName lastName')
        .lean();

    const senderName = `${senderUser?.firstName || ''} ${senderUser?.lastName || ''}`.trim() || 'Un usuario';
    const preview = params.messageContent.length > 90
        ? `${params.messageContent.slice(0, 87)}...`
        : params.messageContent;

    const recipientIds = uniqueStrings(
        Array.isArray(params.conversation.participants)
            ? params.conversation.participants.map((participant: any) => String(participant))
            : []
    ).filter((participantId) => participantId !== params.senderUserId);

    if (recipientIds.length === 0) {
        return;
    }

    const professorUserId = subject.professorId ? String(subject.professorId) : '';

    await NotificationModel.insertMany(
        recipientIds.map((recipientId) => {
            const isProfessorRecipient = recipientId === professorUserId;
            const title = isProfessorRecipient
                ? (params.conversation.kind === 'group'
                    ? `Nuevo mensaje en ${subject.name}`
                    : `Nuevo mensaje de ${senderName}`)
                : (params.conversation.kind === 'group'
                    ? `Nuevo mensaje en ${subject.name}`
                    : `Nuevo mensaje del profesor`);
            const message = isProfessorRecipient
                ? (params.conversation.kind === 'group'
                    ? `${senderName} escribió en el grupo de la asignatura ${subject.name}: "${preview}"`
                    : `${senderName} te envió un mensaje privado sobre ${subject.name}: "${preview}"`)
                : (params.conversation.kind === 'group'
                    ? `${senderName} escribió en el grupo de la asignatura ${subject.name}: "${preview}"`
                    : `${senderName} te envió un mensaje privado sobre ${subject.name}: "${preview}"`);

            return {
                recipientId: new Types.ObjectId(recipientId),
                title,
                message,
                type: 'NEW_MESSAGE',
                link: isProfessorRecipient
                    ? buildProfessorChatLink({
                        subjectId: String(subject._id),
                        conversationId: String(params.conversation._id),
                        subjectName: subject.name,
                        academicYear: subject.academicYear
                    })
                    : '/student/chat'
            };
        }),
        { ordered: false }
    );
};

export const ChatService = {
    async getSubjectConversations(subjectId: string, professorUserId: string) {
        const subject = await ensureProfessorSubject(subjectId, professorUserId);
        const eligibleStudents = await getEligibleStudentsForSubject(subject);

        const groupConversation = await ensureGroupConversation(subject, professorUserId, eligibleStudents);
        await Promise.all(
            eligibleStudents.map((student) => ensurePrivateConversation(subject, professorUserId, student))
        );

        const privateStudentIds = eligibleStudents.map((student) => student.studentId);
        const conversations = await ConversationModel.find({
            subjectId: subject._id,
            $or: [
                { kind: 'group' },
                { kind: 'private', studentId: { $in: privateStudentIds } }
            ]
        })
            .populate({
                path: 'lastMessage',
                populate: {
                    path: 'senderId',
                    select: 'firstName lastName email'
                }
            })
            .sort({ kind: 1, title: 1 })
            .lean();

        const mappedConversations = conversations
            .map((conversation) => {
                const mappedConversation = mapConversation(conversation);

                if (mappedConversation.kind === 'group') {
                    return {
                        ...mappedConversation,
                        participantCount: eligibleStudents.length + 1
                    };
                }

                return {
                    ...mappedConversation,
                    participantCount: 2
                };
            })
            .sort((left, right) => {
                if (left.kind === 'group' && right.kind !== 'group') return -1;
                if (left.kind !== 'group' && right.kind === 'group') return 1;
                return left.title.localeCompare(right.title, 'es');
            });

        return {
            subject: {
                _id: String(subject._id),
                name: subject.name,
                academicYear: subject.academicYear,
                groupConversationId: String(groupConversation._id)
            },
            conversations: mappedConversations
        };
    },

    async getConversationMessages(conversationId: string, userId: string, page = 0, limit = 100) {
        await getAccessibleConversation(conversationId, userId);

        const skip = page * limit;
        const [messages, totalCount] = await Promise.all([
            MessageModel.find({ conversationId })
                .populate('senderId', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            MessageModel.countDocuments({ conversationId })
        ]);

        return {
            data: messages.reverse().map((message) => mapMessage(message)),
            totalCount,
            page,
            limit
        };
    },

    async createMessage(conversationId: string, senderUserId: string, content: string) {
        const trimmedContent = content.trim();
        if (!trimmedContent) {
            throw new Error('El mensaje no puede estar vacío.');
        }

        const conversation = await getAccessibleConversation(conversationId, senderUserId);

        const createdMessage = await MessageModel.create({
            conversationId: new Types.ObjectId(conversationId),
            senderId: new Types.ObjectId(senderUserId),
            content: trimmedContent
        });

        await ConversationModel.findByIdAndUpdate(conversationId, {
            lastMessage: createdMessage._id
        });

        const populatedMessage = await MessageModel.findById(createdMessage._id)
            .populate('senderId', 'firstName lastName email')
            .lean();

        const payload = mapMessage(populatedMessage);

        await createChatNotificationsForRecipients({
            conversation,
            senderUserId,
            messageContent: trimmedContent
        });

        emitToConversationParticipants(conversation, 'chat:message-created', payload);

        return payload;
    },

    async deleteMessage(messageId: string, userId: string) {
        const message = await MessageModel.findById(messageId).lean();
        if (!message) {
            throw new Error('Mensaje no encontrado.');
        }

        if (String(message.senderId) !== userId) {
            throw new Error('Solo puedes eliminar tus propios mensajes.');
        }

        const conversation = await getAccessibleConversation(String(message.conversationId), userId);

        await MessageModel.findByIdAndDelete(messageId);

        const latestMessage = await MessageModel.findOne({
            conversationId: message.conversationId
        })
            .populate('senderId', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .lean();

        await ConversationModel.findByIdAndUpdate(message.conversationId, {
            lastMessage: latestMessage?._id || null
        });

        const payload = {
            messageId,
            conversationId: String(message.conversationId),
            lastMessage: latestMessage ? mapMessage(latestMessage) : null
        };

        emitToConversationParticipants(conversation, 'chat:message-deleted', payload);

        return payload;
    }
};
