import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Divider,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    Stack,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Forum as ForumIcon,
    Person as PersonIcon,
    Refresh as RefreshIcon,
    Send as SendIcon
} from '@mui/icons-material';
import MainLayout from '../../layouts/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import { ModalDialog } from '../../components/common/ModalDialog';
import { useAuth } from '../../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE;

interface ChatSender {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
}

interface ChatMessage {
    _id: string;
    conversationId: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    sender: ChatSender;
}

interface ConversationSummary {
    _id: string;
    subjectId: string;
    subjectName?: string;
    careerName?: string;
    academicYear?: number;
    kind: 'group' | 'private';
    title: string;
    participantCount: number;
    professorUserId?: string | null;
    hasLinkedUser?: boolean;
    updatedAt?: string;
    lastMessage: ChatMessage | null;
}

interface MessageDeletedPayload {
    messageId: string;
    conversationId: string;
    lastMessage: ChatMessage | null;
}

const getSocketBaseUrl = () => {
    if (!API_BASE) return window.location.origin;
    return API_BASE.replace(/\/api\/?$/, '');
};

const sortConversations = (items: ConversationSummary[]) => [...items].sort((left, right) => {
    if (left.kind === 'group' && right.kind !== 'group') return -1;
    if (left.kind !== 'group' && right.kind === 'group') return 1;
    if (left.subjectName !== right.subjectName) {
        return (left.subjectName || '').localeCompare(right.subjectName || '', 'es');
    }
    return left.title.localeCompare(right.title, 'es');
});

const formatMessageTime = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('es-CU', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const getConversationPreview = (conversation: ConversationSummary) => {
    if (conversation.lastMessage?.content) {
        return conversation.lastMessage.content;
    }

    if (conversation.kind === 'group') {
        return 'Grupo de la asignatura';
    }

    return 'Chat privado con el profesor';
};

const getConversationSecondaryLabel = (conversation: ConversationSummary) => {
    const subjectPart = conversation.subjectName ? `Asignatura: ${conversation.subjectName}` : '';
    const careerPart = conversation.careerName ? `Carrera: ${conversation.careerName}` : '';
    const yearPart = typeof conversation.academicYear === 'number'
        ? `Año: ${conversation.academicYear}`
        : '';

    return [subjectPart, careerPart, yearPart].filter(Boolean).join(' | ');
};

const ChatPage: React.FC = () => {
    const navigate = useNavigate();
    const { token, user, logout } = useAuth();
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draftMessage, setDraftMessage] = useState('');
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
    const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const selectedConversationIdRef = useRef('');
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const selectedConversation = useMemo(
        () => conversations.find((conversation) => conversation._id === selectedConversationId) || null,
        [conversations, selectedConversationId]
    );

    const authorizedFetch = useCallback(async (path: string, options: RequestInit = {}) => {
        if (!token) {
            throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');
        }

        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                Authorization: `Bearer ${token}`,
                ...(options.headers || {})
            }
        });

        if (response.status === 401) {
            logout();
            throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');
        }

        const result = await response.json().catch(() => null);
        if (!response.ok) {
            const message = result?.error || result?.message || 'No se pudo completar la operación.';
            throw new Error(message);
        }

        return result;
    }, [logout, token]);

    const loadConversations = useCallback(async () => {
        setLoadingConversations(true);
        setError(null);

        try {
            const result = await authorizedFetch('/chat/student-conversations');
            const nextConversations = sortConversations(
                Array.isArray(result?.conversations) ? result.conversations as ConversationSummary[] : []
            );

            setConversations(nextConversations);
            setSelectedConversationId((current) => {
                if (current && nextConversations.some((conversation) => conversation._id === current)) {
                    return current;
                }
                return nextConversations[0]?._id || '';
            });
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : 'No se pudieron cargar los chats.');
            setConversations([]);
            setSelectedConversationId('');
        } finally {
            setLoadingConversations(false);
        }
    }, [authorizedFetch]);

    const loadMessages = useCallback(async (conversationId: string) => {
        if (!conversationId) {
            setMessages([]);
            return;
        }

        setLoadingMessages(true);
        setError(null);

        try {
            const result = await authorizedFetch(`/chat/conversations/${conversationId}/messages?page=0&limit=200`);
            setMessages(Array.isArray(result?.data) ? result.data as ChatMessage[] : []);
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : 'No se pudieron cargar los mensajes.');
            setMessages([]);
        } finally {
            setLoadingMessages(false);
        }
    }, [authorizedFetch]);

    useEffect(() => {
        selectedConversationIdRef.current = selectedConversationId;
    }, [selectedConversationId]);

    useEffect(() => {
        void loadConversations();
    }, [loadConversations]);

    useEffect(() => {
        void loadMessages(selectedConversationId);
    }, [loadMessages, selectedConversationId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!token) return;

        const socket = io(getSocketBaseUrl(), {
            auth: { token },
            transports: ['websocket']
        });

        socket.on('chat:message-created', (message: ChatMessage) => {
            setConversations((current) => sortConversations(current.map((conversation) => (
                conversation._id === message.conversationId
                    ? { ...conversation, lastMessage: message }
                    : conversation
            ))));

            if (selectedConversationIdRef.current !== message.conversationId) {
                return;
            }

            setMessages((current) => (
                current.some((existing) => existing._id === message._id)
                    ? current
                    : [...current, message]
            ));
        });

        socket.on('chat:message-deleted', (payload: MessageDeletedPayload) => {
            setConversations((current) => sortConversations(current.map((conversation) => (
                conversation._id === payload.conversationId
                    ? { ...conversation, lastMessage: payload.lastMessage }
                    : conversation
            ))));

            if (selectedConversationIdRef.current !== payload.conversationId) {
                return;
            }

            setMessages((current) => current.filter((message) => message._id !== payload.messageId));
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [token]);

    const handleSendMessage = async () => {
        const trimmedMessage = draftMessage.trim();
        if (!trimmedMessage || !selectedConversationId) {
            return;
        }

        setSendingMessage(true);
        setError(null);

        try {
            await authorizedFetch(`/chat/conversations/${selectedConversationId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content: trimmedMessage })
            });
            setDraftMessage('');
        } catch (sendError) {
            setError(sendError instanceof Error ? sendError.message : 'No se pudo enviar el mensaje.');
        } finally {
            setSendingMessage(false);
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        setDeletingMessageId(messageId);
        setError(null);

        try {
            await authorizedFetch(`/chat/messages/${messageId}`, {
                method: 'DELETE'
            });
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el mensaje.');
        } finally {
            setDeletingMessageId(null);
        }
    };

    const handleRequestDeleteMessage = (messageId: string) => {
        setPendingDeleteMessageId(messageId);
    };

    const handleCloseDeleteDialog = () => {
        if (deletingMessageId) return;
        setPendingDeleteMessageId(null);
    };

    const handleConfirmDeleteMessage = async () => {
        if (!pendingDeleteMessageId) return;
        const messageId = pendingDeleteMessageId;
        setPendingDeleteMessageId(null);
        await handleDeleteMessage(messageId);
    };

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleSendMessage();
        }
    };

    return (
        <MainLayout>
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <PageHeader
                    title="Mis Chats"
                    subtitle="Grupos de tus asignaturas matriculadas y chats privados con sus profesores."
                    showBackButton={true}
                    action={
                        <Tooltip title="Recargar chats">
                            <IconButton color="primary" onClick={() => void loadConversations()}>
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    }
                />

                {error && (
                    <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                        {error}
                    </Alert>
                )}

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ minHeight: { md: '72vh' } }}>
                    <Paper
                        elevation={0}
                        sx={{
                            width: { xs: '100%', md: 380 },
                            height: { xs: 420, md: '72vh' },
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            overflow: 'hidden'
                        }}
                    >
                        <Box sx={{ p: 2.5 }}>
                            <Typography variant="h6">Conversaciones</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Verás los grupos de asignaturas y los chats privados con profesores.
                            </Typography>
                        </Box>
                        <Divider />

                        {loadingConversations ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                                <CircularProgress />
                            </Box>
                        ) : conversations.length === 0 ? (
                            <Box sx={{ p: 3 }}>
                                <Typography color="text.secondary" sx={{ mb: 2 }}>
                                    No tienes chats académicos disponibles por el momento.
                                </Typography>
                                <Button variant="contained" onClick={() => navigate(-1)}>
                                    Volver
                                </Button>
                            </Box>
                        ) : (
                            <List
                                disablePadding
                                sx={{
                                    flex: 1,
                                    overflowY: 'auto'
                                }}
                            >
                                {conversations.map((conversation) => (
                                    <ListItemButton
                                        key={conversation._id}
                                        selected={conversation._id === selectedConversationId}
                                        onClick={() => setSelectedConversationId(conversation._id)}
                                        sx={{
                                            alignItems: 'flex-start',
                                            py: 2,
                                            px: 2.5
                                        }}
                                    >
                                        <Avatar sx={{ mr: 2, bgcolor: conversation.kind === 'group' ? 'secondary.main' : 'primary.main' }}>
                                            {conversation.kind === 'group' ? <ForumIcon /> : <PersonIcon />}
                                        </Avatar>
                                        <ListItemText
                                            primary={
                                                <Stack spacing={0.75}>
                                                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                                                        <Typography variant="subtitle2" fontWeight={700}>
                                                            {conversation.title}
                                                        </Typography>
                                                        <Chip
                                                            size="small"
                                                            label={conversation.kind === 'group' ? 'Grupo' : 'Privado'}
                                                            color={conversation.kind === 'group' ? 'secondary' : 'primary'}
                                                            variant="outlined"
                                                        />
                                                    </Stack>
                                                    {getConversationSecondaryLabel(conversation) && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {getConversationSecondaryLabel(conversation)}
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            }
                                            secondary={
                                                <Box sx={{ mt: 0.5 }}>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                        sx={{
                                                            display: '-webkit-box',
                                                            overflow: 'hidden',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical'
                                                        }}
                                                    >
                                                        {getConversationPreview(conversation)}
                                                    </Typography>
                                                    {conversation.lastMessage?.createdAt && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {formatMessageTime(conversation.lastMessage.createdAt)}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            }
                                        />
                                    </ListItemButton>
                                ))}
                            </List>
                        )}
                    </Paper>

                    <Paper
                        elevation={0}
                        sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            overflow: 'hidden'
                        }}
                    >
                        {selectedConversation ? (
                            <>
                                <Box sx={{ px: 3, py: 2.5 }}>
                                    <Stack spacing={1}>
                                        <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap">
                                            <Typography variant="h6">
                                                {selectedConversation.title}
                                            </Typography>
                                            <Chip
                                                size="small"
                                                label={selectedConversation.kind === 'group'
                                                    ? `${selectedConversation.participantCount} participantes`
                                                    : 'Chat privado'}
                                                color={selectedConversation.kind === 'group' ? 'secondary' : 'primary'}
                                            />
                                        </Stack>
                                        {getConversationSecondaryLabel(selectedConversation) && (
                                            <Typography variant="body2" color="text.secondary">
                                                {getConversationSecondaryLabel(selectedConversation)}
                                            </Typography>
                                        )}
                                    </Stack>
                                </Box>
                                <Divider />

                                <Box
                                    sx={{
                                        flex: 1,
                                        p: 3,
                                        bgcolor: '#f7f9fc',
                                        overflowY: 'auto'
                                    }}
                                >
                                    {loadingMessages ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                                            <CircularProgress />
                                        </Box>
                                    ) : messages.length === 0 ? (
                                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Typography color="text.secondary">
                                                Todavía no hay mensajes en esta conversación.
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Stack spacing={2}>
                                            {messages.map((message) => {
                                                const isOwnMessage = message.sender._id === user?._id;
                                                return (
                                                    <Box
                                                        key={message._id}
                                                        sx={{
                                                            display: 'flex',
                                                            justifyContent: isOwnMessage ? 'flex-end' : 'flex-start'
                                                        }}
                                                    >
                                                        <Stack
                                                            direction={isOwnMessage ? 'row-reverse' : 'row'}
                                                            spacing={1}
                                                            alignItems="flex-start"
                                                            sx={{ maxWidth: { xs: '90%', md: '75%' } }}
                                                        >
                                                            <Paper
                                                                elevation={0}
                                                                sx={{
                                                                    px: 2,
                                                                    py: 1.5,
                                                                    borderRadius: 3,
                                                                    bgcolor: isOwnMessage ? 'primary.main' : 'background.paper',
                                                                    color: isOwnMessage ? 'primary.contrastText' : 'text.primary',
                                                                    border: isOwnMessage ? 'none' : '1px solid',
                                                                    borderColor: 'divider'
                                                                }}
                                                            >
                                                                {!isOwnMessage && (
                                                                    <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
                                                                        {`${message.sender.firstName} ${message.sender.lastName}`.trim() || 'Usuario'}
                                                                    </Typography>
                                                                )}
                                                                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                                    {message.content}
                                                                </Typography>
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{
                                                                        display: 'block',
                                                                        mt: 0.75,
                                                                        textAlign: isOwnMessage ? 'right' : 'left',
                                                                        opacity: 0.8
                                                                    }}
                                                                >
                                                                    {formatMessageTime(message.createdAt)}
                                                                </Typography>
                                                            </Paper>

                                                            {isOwnMessage && (
                                                                <Tooltip title="Eliminar mensaje">
                                                                    <span>
                                                                        <IconButton
                                                                            size="small"
                                                                            color="error"
                                                                            disabled={deletingMessageId === message._id}
                                                                            onClick={() => handleRequestDeleteMessage(message._id)}
                                                                        >
                                                                            <DeleteIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </span>
                                                                </Tooltip>
                                                            )}
                                                        </Stack>
                                                    </Box>
                                                );
                                            })}
                                            <Box ref={messagesEndRef} />
                                        </Stack>
                                    )}
                                </Box>

                                <Divider />
                                <Box sx={{ p: 2.5 }}>
                                    <Stack direction="row" spacing={2} alignItems="flex-end">
                                        <TextField
                                            fullWidth
                                            multiline
                                            minRows={2}
                                            maxRows={5}
                                            placeholder="Escribe un mensaje..."
                                            value={draftMessage}
                                            onChange={(event) => setDraftMessage(event.target.value)}
                                            onKeyDown={handleInputKeyDown}
                                        />
                                        <Button
                                            variant="contained"
                                            endIcon={<SendIcon />}
                                            onClick={() => void handleSendMessage()}
                                            disabled={sendingMessage || !draftMessage.trim()}
                                            sx={{ minWidth: 140, height: 56 }}
                                        >
                                            Enviar
                                        </Button>
                                    </Stack>
                                </Box>
                            </>
                        ) : (
                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                                <Typography color="text.secondary">
                                    Selecciona una conversación para comenzar a chatear.
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Stack>
            </Container>

            <ModalDialog
                open={Boolean(pendingDeleteMessageId)}
                onClose={handleCloseDeleteDialog}
                onConfirm={() => void handleConfirmDeleteMessage()}
                title="Eliminar mensaje"
                description="¿Estás seguro de que deseas eliminar este mensaje? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="error"
            />
        </MainLayout>
    );
};

export default ChatPage;
