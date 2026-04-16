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
    CareerModel,
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

const getStudentIdentity = async (studentUserId: string) => {
    const user = await UserModel.findById(studentUserId)
        .select('_id firstName lastName email studentId')
        .lean();

    if (!user?.studentId) {
        throw new Error('El estudiante autenticado no tiene un perfil academico vinculado.');
    }

    const student = await StudentModel.findById(user.studentId)
        .select('_id firstName lastName careerId academicYear')
        .lean();

    if (!student) {
        throw new Error('No se encontro la informacion academica del estudiante autenticado.');
    }

    return { user, student };
};

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

const buildChatNotificationPreview = (content: string) => (
    content.length > 90 ? `${content.slice(0, 87)}...` : content
);

const buildChatNotificationContent = (params: {
    conversation: any;
    recipientId: string;
    senderName: string;
    preview: string;
    subject: any;
}) => {
    const professorUserId = params.subject.professorId ? String(params.subject.professorId) : '';
    const isProfessorRecipient = params.recipientId === professorUserId;

    return {
        title: isProfessorRecipient
            ? (params.conversation.kind === 'group'
                ? `Nuevo mensaje en ${params.subject.name}`
                : `Nuevo mensaje de ${params.senderName}`)
            : (params.conversation.kind === 'group'
                ? `Nuevo mensaje en ${params.subject.name}`
                : 'Nuevo mensaje del profesor'),
        message: params.conversation.kind === 'group'
            ? `${params.senderName} escribió en el grupo de la asignatura ${params.subject.name}: "${params.preview}"`
            : `${params.senderName} te envió un mensaje privado sobre ${params.subject.name}: "${params.preview}"`,
        link: isProfessorRecipient
            ? buildProfessorChatLink({
                subjectId: String(params.subject._id),
                conversationId: String(params.conversation._id),
                subjectName: params.subject.name,
                academicYear: params.subject.academicYear
            })
            : '/student/chat'
    };
};

const markChatNotificationAsRead = async (conversationId: string, recipientUserId: string) => {
    await NotificationModel.updateOne(
        {
            recipientId: new Types.ObjectId(recipientUserId),
            conversationId: new Types.ObjectId(conversationId),
            type: 'NEW_MESSAGE',
            isRead: false
        },
        {
            $set: {
                isRead: true,
                updatedAt: new Date()
            }
        }
    );
};

const collapseChatNotificationDuplicates = async (conversationId: string, recipientIds: string[]) => {
    if (recipientIds.length === 0) {
        return;
    }

    const recipientObjectIds = recipientIds.map((recipientId) => new Types.ObjectId(recipientId));
    const existingNotifications = await NotificationModel.find({
        type: 'NEW_MESSAGE',
        conversationId: new Types.ObjectId(conversationId),
        recipientId: { $in: recipientObjectIds }
    })
        .select('_id recipientId updatedAt createdAt')
        .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
        .lean();

    const keptRecipientIds = new Set<string>();
    const duplicateIdsToDelete: Types.ObjectId[] = [];

    for (const notification of existingNotifications) {
        const recipientId = String(notification.recipientId);
        if (!keptRecipientIds.has(recipientId)) {
            keptRecipientIds.add(recipientId);
            continue;
        }

        duplicateIdsToDelete.push(notification._id);
    }

    if (duplicateIdsToDelete.length > 0) {
        await NotificationModel.deleteMany({
            _id: { $in: duplicateIdsToDelete }
        });
    }
};

const upsertChatNotificationsForRecipients = async (params: {
    conversation: any;
    senderUserId: string;
    messageId: string;
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
    const preview = buildChatNotificationPreview(params.messageContent);

    const recipientIds = uniqueStrings(
        Array.isArray(params.conversation.participants)
            ? params.conversation.participants.map((participant: any) => String(participant))
            : []
    ).filter((participantId) => participantId !== params.senderUserId);

    if (recipientIds.length === 0) {
        return;
    }

    await collapseChatNotificationDuplicates(String(params.conversation._id), recipientIds);

    const conversationObjectId = new Types.ObjectId(String(params.conversation._id));
    const senderObjectId = new Types.ObjectId(params.senderUserId);
    const lastMessageObjectId = new Types.ObjectId(params.messageId);
    const now = new Date();

    await NotificationModel.bulkWrite(
        recipientIds.map((recipientId) => {
            const recipientObjectId = new Types.ObjectId(recipientId);
            const notificationContent = buildChatNotificationContent({
                conversation: params.conversation,
                recipientId,
                senderName,
                preview,
                subject
            });

            return {
                updateOne: {
                    filter: {
                        recipientId: recipientObjectId,
                        conversationId: conversationObjectId,
                        type: 'NEW_MESSAGE'
                    },
                    update: {
                        $set: {
                            ...notificationContent,
                            senderId: senderObjectId,
                            lastMessageId: lastMessageObjectId,
                            isRead: false,
                            updatedAt: now
                        },
                        $setOnInsert: {
                            recipientId: recipientObjectId,
                            conversationId: conversationObjectId,
                            type: 'NEW_MESSAGE',
                            createdAt: now
                        }
                    },
                    upsert: true
                }
            };
        }),
        { ordered: false }
    );
};

const syncChatNotificationsAfterMessageDeletion = async (params: {
    conversation: any;
    deletedMessageId: string;
    conversationId: string;
}) => {
    const notifications = await NotificationModel.find({
        type: 'NEW_MESSAGE',
        conversationId: new Types.ObjectId(params.conversationId),
        lastMessageId: new Types.ObjectId(params.deletedMessageId)
    })
        .select('_id recipientId isRead')
        .lean();

    if (notifications.length === 0) {
        return;
    }

    const subject = await SubjectModel.findById(params.conversation.subjectId)
        .select('_id name academicYear professorId')
        .lean();

    if (!subject) {
        await NotificationModel.deleteMany({
            _id: { $in: notifications.map((notification) => notification._id) }
        });
        return;
    }

    const bulkOps = [];
    const now = new Date();

    for (const notification of notifications) {
        if (notification.isRead) {
            bulkOps.push({
                deleteOne: {
                    filter: { _id: notification._id }
                }
            });
            continue;
        }

        const recipientId = String(notification.recipientId);
        const previousIncomingMessage = await MessageModel.findOne({
            conversationId: new Types.ObjectId(params.conversationId),
            senderId: { $ne: new Types.ObjectId(recipientId) }
        })
            .populate('senderId', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .lean();

        if (!previousIncomingMessage) {
            bulkOps.push({
                deleteOne: {
                    filter: { _id: notification._id }
                }
            });
            continue;
        }

        const sender = mapMessageSender((previousIncomingMessage as any).senderId);
        const senderName = `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'Un usuario';
        const notificationContent = buildChatNotificationContent({
            conversation: params.conversation,
            recipientId,
            senderName,
            preview: buildChatNotificationPreview(previousIncomingMessage.content || ''),
            subject
        });

        bulkOps.push({
            updateOne: {
                filter: { _id: notification._id },
                update: {
                    $set: {
                        ...notificationContent,
                        senderId: new Types.ObjectId(String(sender._id)),
                        lastMessageId: new Types.ObjectId(String(previousIncomingMessage._id)),
                        isRead: false,
                        updatedAt: now
                    }
                }
            }
        });
    }

    if (bulkOps.length > 0) {
        await NotificationModel.bulkWrite(bulkOps, { ordered: false });
    }
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
        await markChatNotificationAsRead(conversationId, userId);

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

    async getStudentConversations(studentUserId: string) {
        const { user, student } = await getStudentIdentity(studentUserId);

        const enrolledRows = await MatriculatedSubjectModel.find({
            studentId: student._id,
            academicYear: student.academicYear
        })
            .select('subjectId')
            .lean();

        const enrolledSubjectIds = uniqueStrings(enrolledRows.map((row) => String(row.subjectId)));
        if (enrolledSubjectIds.length === 0) {
            return { conversations: [] };
        }

        const [subjects, career] = await Promise.all([
            SubjectModel.find({
                _id: { $in: enrolledSubjectIds },
                careerId: student.careerId,
                academicYear: student.academicYear,
                professorId: { $exists: true, $ne: null }
            })
                .select('_id name academicYear careerId professorId')
                .sort({ name: 1 })
                .lean(),
            CareerModel.findById(student.careerId).select('name').lean()
        ]);

        if (subjects.length === 0) {
            return { conversations: [] };
        }

        const professorIds = uniqueStrings(subjects.map((subject) => (
            subject.professorId ? String(subject.professorId) : null
        )));

        const professorUsers = await UserModel.find({
            _id: { $in: professorIds }
        })
            .select('_id firstName lastName')
            .lean();

        const professorNameById = new Map(
            professorUsers.map((professor) => [
                String(professor._id),
                `${professor.firstName || ''} ${professor.lastName || ''}`.trim() || 'Profesor'
            ])
        );

        const conversationIds: string[] = [];
        const conversationMetadataById = new Map<string, {
            subjectName: string;
            careerName: string;
            academicYear: number;
            professorUserId: string | null;
            participantCount: number;
            privateTitle: string;
        }>();

        for (const subject of subjects) {
            const professorUserId = subject.professorId ? String(subject.professorId) : '';
            if (!professorUserId) {
                continue;
            }

            const eligibleStudents = await getEligibleStudentsForSubject(subject);
            const groupConversation = await ensureGroupConversation(subject, professorUserId, eligibleStudents);
            const privateConversation = await ensurePrivateConversation(subject, professorUserId, {
                studentId: String(student._id),
                firstName: student.firstName || user.firstName || '',
                lastName: student.lastName || user.lastName || '',
                linkedUser: {
                    _id: String(user._id)
                }
            });

            conversationIds.push(String(groupConversation._id), String(privateConversation._id));

            const careerName = career?.name || 'Sin carrera';
            const professorName = professorNameById.get(professorUserId) || 'Profesor';

            conversationMetadataById.set(String(groupConversation._id), {
                subjectName: subject.name,
                careerName,
                academicYear: subject.academicYear,
                professorUserId,
                participantCount: eligibleStudents.length + 1,
                privateTitle: professorName
            });

            conversationMetadataById.set(String(privateConversation._id), {
                subjectName: subject.name,
                careerName,
                academicYear: subject.academicYear,
                professorUserId,
                participantCount: 2,
                privateTitle: professorName
            });
        }

        const conversations = await ConversationModel.find({
            _id: { $in: conversationIds },
            participants: new Types.ObjectId(studentUserId)
        })
            .populate({
                path: 'lastMessage',
                populate: {
                    path: 'senderId',
                    select: 'firstName lastName email'
                }
            })
            .lean();

        const mappedConversations = conversations
            .map((conversation) => {
                const mappedConversation = mapConversation(conversation);
                const metadata = conversationMetadataById.get(mappedConversation._id);

                return {
                    ...mappedConversation,
                    title: mappedConversation.kind === 'private'
                        ? (metadata?.privateTitle || 'Profesor')
                        : mappedConversation.title,
                    participantCount: metadata?.participantCount || mappedConversation.participantCount,
                    subjectName: metadata?.subjectName || '',
                    careerName: metadata?.careerName || 'Sin carrera',
                    academicYear: metadata?.academicYear || 0,
                    professorUserId: metadata?.professorUserId || null
                };
            })
            .sort((left, right) => {
                if (left.subjectName !== right.subjectName) {
                    return (left.subjectName || '').localeCompare(right.subjectName || '', 'es');
                }
                if (left.kind === 'group' && right.kind !== 'group') return -1;
                if (left.kind !== 'group' && right.kind === 'group') return 1;
                return left.title.localeCompare(right.title, 'es');
            });

        return {
            conversations: mappedConversations
        };
    },

    async createMessage(conversationId: string, senderUserId: string, content: string) {
        const trimmedContent = content.trim();
        if (!trimmedContent) {
            throw new Error('El mensaje no puede estar vacío.');
        }

        const conversation = await getAccessibleConversation(conversationId, senderUserId);
        await markChatNotificationAsRead(conversationId, senderUserId);

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

        await upsertChatNotificationsForRecipients({
            conversation,
            senderUserId,
            messageId: String(createdMessage._id),
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

        await syncChatNotificationsAfterMessageDeletion({
            conversation,
            deletedMessageId: messageId,
            conversationId: String(message.conversationId)
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
