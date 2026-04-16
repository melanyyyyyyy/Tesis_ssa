import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service.js';

const toInteger = (value: unknown, fallback: number) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getStatusCodeForChatError = (error: unknown) => {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('no puede estar vacío')) return 400;
    if (message.includes('sin acceso') || message.includes('solo puedes eliminar')) return 403;
    if (message.includes('no encontrado')) return 404;
    return 500;
};

export const ChatController = {
    async getSubjectConversations(req: Request, res: Response) {
        try {
            const subjectId = String(req.query.subjectId || '');
            const userId = String(req.user?.id || '');

            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }

            if (!subjectId) {
                return res.status(400).json({ message: 'subjectId es requerido' });
            }

            const result = await ChatService.getSubjectConversations(subjectId, userId);
            return res.status(200).json(result);
        } catch (error: any) {
            console.error('Error in getSubjectConversations:', error);
            return res.status(getStatusCodeForChatError(error)).json({
                success: false,
                error: error.message || 'No se pudieron cargar las conversaciones.'
            });
        }
    },

    async getStudentConversations(req: Request, res: Response) {
        try {
            const userId = String(req.user?.id || '');

            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }

            const result = await ChatService.getStudentConversations(userId);
            return res.status(200).json(result);
        } catch (error: any) {
            console.error('Error in getStudentConversations:', error);
            return res.status(getStatusCodeForChatError(error)).json({
                success: false,
                error: error.message || 'No se pudieron cargar las conversaciones del estudiante.'
            });
        }
    },

    async getConversationMessages(req: Request, res: Response) {
        try {
            const conversationId = String(req.params.conversationId || '');
            const userId = String(req.user?.id || '');
            const page = toInteger(req.query.page, 0);
            const limit = toInteger(req.query.limit, 100);

            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }

            if (!conversationId) {
                return res.status(400).json({ message: 'conversationId es requerido' });
            }

            const result = await ChatService.getConversationMessages(conversationId, userId, page, limit);
            return res.status(200).json(result);
        } catch (error: any) {
            console.error('Error in getConversationMessages:', error);
            return res.status(getStatusCodeForChatError(error)).json({
                success: false,
                error: error.message || 'No se pudieron cargar los mensajes.'
            });
        }
    },

    async createMessage(req: Request, res: Response) {
        try {
            const conversationId = String(req.params.conversationId || '');
            const userId = String(req.user?.id || '');
            const content = String(req.body?.content || '');

            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }

            if (!conversationId) {
                return res.status(400).json({ message: 'conversationId es requerido' });
            }

            const result = await ChatService.createMessage(conversationId, userId, content);
            return res.status(201).json(result);
        } catch (error: any) {
            console.error('Error in createMessage:', error);
            return res.status(getStatusCodeForChatError(error)).json({
                success: false,
                error: error.message || 'No se pudo enviar el mensaje.'
            });
        }
    },

    async deleteMessage(req: Request, res: Response) {
        try {
            const messageId = String(req.params.messageId || '');
            const userId = String(req.user?.id || '');

            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }

            if (!messageId) {
                return res.status(400).json({ message: 'messageId es requerido' });
            }

            const result = await ChatService.deleteMessage(messageId, userId);
            return res.status(200).json(result);
        } catch (error: any) {
            console.error('Error in deleteMessage:', error);
            return res.status(getStatusCodeForChatError(error)).json({
                success: false,
                error: error.message || 'No se pudo eliminar el mensaje.'
            });
        }
    }
};
