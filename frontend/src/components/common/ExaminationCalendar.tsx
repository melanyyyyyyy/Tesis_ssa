import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Card,
    CardContent,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    type SelectChangeEvent,
    Stack,
    Typography,
    useTheme,
    alpha
} from '@mui/material';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import type { SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ModalDialog } from './ModalDialog';
import { useAuth } from '../../context/AuthContext';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const API_BASE = import.meta.env.VITE_API_BASE;

const locales = {
    es
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales
});

type EntityInput = string | { _id: string; name?: string };

interface ExaminationCalendarProps {
    carrera: EntityInput;
    asignatura?: EntityInput;
    academicYear?: number;
    height?: number;
    readOnly?: boolean;
}

interface SubjectOption {
    _id: string;
    name: string;
    academicYear: number;
}

interface ExaminationTypeOption {
    _id: string;
    name: string;
    priority?: number;
}

interface ExamCalendarEventFromApi {
    _id: string;
    examDate: string;
    subjectId: { _id: string; name: string } | string;
    examinationTypeId: { _id: string; name: string } | string;
}

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    resource: ExamCalendarEventFromApi;
}

const getEntityId = (value: EntityInput | undefined): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    return value._id;
};

const ExaminationCalendar: React.FC<ExaminationCalendarProps> = ({
    carrera,
    asignatura,
    academicYear,
    height = 650,
    readOnly = false
}) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [events, setEvents] = useState<ExamCalendarEventFromApi[]>([]);
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [examinationTypes, setExaminationTypes] = useState<ExaminationTypeOption[]>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [selectedExaminationTypeId, setSelectedExaminationTypeId] = useState<string>('');
    const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [calendarDate, setCalendarDate] = useState<Date>(new Date());
    const theme = useTheme();

    const careerId = useMemo(() => getEntityId(carrera), [carrera]);
    const fixedSubjectId = useMemo(() => getEntityId(asignatura), [asignatura]);

    const fetchEvents = useCallback(async () => {
        if (!token || !careerId) return;

        const params = new URLSearchParams({ careerId });
        if (academicYear) {
            params.set('academicYear', String(academicYear));
        }
        const response = await fetch(`${API_BASE}/common/exam-calendars?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('No se pudo cargar el calendario de exámenes');
        }

        const data = await response.json();
        setEvents(data.events || []);
    }, [academicYear, careerId, token]);

    const fetchSubjects = useCallback(async () => {
        if (!token || !careerId || fixedSubjectId) return;

        const params = new URLSearchParams({ careerId });
        if (academicYear) {
            params.set('academicYear', String(academicYear));
        }
        const response = await fetch(`${API_BASE}/common/subjects?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('No se pudieron cargar las asignaturas');
        }

        const data = await response.json();
        setSubjects(data.subjects || []);
    }, [academicYear, careerId, fixedSubjectId, token]);

    const fetchExaminationTypes = useCallback(async () => {
        if (!token) return;

        const response = await fetch(`${API_BASE}/common/examination-types`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('No se pudieron cargar los tipos de examen');
        }

        const data = await response.json();
        const types = data.examinationTypes || [];
        setExaminationTypes(types);
        if (types.length > 0) {
            setSelectedExaminationTypeId(types[0]._id);
        }
    }, [token]);

    useEffect(() => {
        const initialize = async () => {
            if (!careerId) {
                setError('Debes pasar una carrera válida al componente.');
                setLoading(false);
                return;
            }

            if (fixedSubjectId) {
                setSelectedSubjectId(fixedSubjectId);
            } else {
                setSelectedSubjectId('');
            }

            setLoading(true);
            setError(null);
            try {
                await Promise.all([
                    fetchEvents(),
                    fetchSubjects(),
                    fetchExaminationTypes()
                ]);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error desconocido');
            } finally {
                setLoading(false);
            }
        };

        void initialize();
    }, [careerId, fixedSubjectId, fetchEvents, fetchExaminationTypes, fetchSubjects]);

    const calendarEvents: CalendarEvent[] = useMemo(() => {
        return events.map((event) => {
            const subjectName =
                typeof event.subjectId === 'string'
                    ? 'Asignatura'
                    : event.subjectId.name;

            const examTypeName =
                typeof event.examinationTypeId === 'string'
                    ? 'Examen'
                    : event.examinationTypeId.name;

            const date = new Date(event.examDate);

            return {
                id: event._id,
                title: `${subjectName} - ${examTypeName}`,
                start: date,
                end: date,
                allDay: true,
                resource: event
            };
        });
    }, [events]);

    const subjectToCreate = fixedSubjectId || selectedSubjectId;

    const handleCreateEvent = async (slot: SlotInfo) => {
        if (readOnly) return;
        if (!token || !careerId) return;
        if (!subjectToCreate) {
            setError('Selecciona una asignatura para crear el examen.');
            return;
        }
        if (!selectedExaminationTypeId) {
            setError('Selecciona un tipo de examen.');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            const response = await fetch(`${API_BASE}/common/exam-calendars`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    careerId,
                    subjectId: subjectToCreate,
                    examinationTypeId: selectedExaminationTypeId,
                    examDate: slot.start
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'No se pudo crear el evento');
            }

            await fetchEvents();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteEvent = async () => {
        if (readOnly) return;
        if (!token || !eventToDelete) return;

        try {
            setSubmitting(true);
            setError(null);

            const response = await fetch(`${API_BASE}/common/exam-calendars/${eventToDelete.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(
                    fixedSubjectId
                        ? { subjectId: fixedSubjectId }
                        : {}
                ),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'No se pudo eliminar el evento');
            }

            setEvents((prev) => prev.filter((event) => event._id !== eventToDelete.id));
            setDeleteModalOpen(false);
            setEventToDelete(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubjectChange = (event: SelectChangeEvent<string>) => {
        setSelectedSubjectId(event.target.value);
    };

    const handleExaminationTypeChange = (event: SelectChangeEvent<string>) => {
        setSelectedExaminationTypeId(event.target.value);
    };

    const handleNavigate = (newDate: Date) => {
        setCalendarDate(newDate);
    };

    const eventStyleGetter = () => {
        return {
            style: {
                backgroundColor: alpha(theme.palette.secondary.main, 0.99),
                color: 'white',
                borderRadius: `${theme.shape.borderRadius}px`,
                boxShadow: theme.customShadows.sm,
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'block',
                padding: '2px 8px'
            }
        };
    };

    return (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <CardContent>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                    {!fixedSubjectId && (
                        <FormControl fullWidth disabled={loading || submitting}>
                            <InputLabel id="calendar-subject-label">Asignatura</InputLabel>
                            <Select
                                labelId="calendar-subject-label"
                                value={selectedSubjectId}
                                label="Asignatura"
                                onChange={handleSubjectChange}
                            >
                                {subjects.length === 0 ? (
                                    <MenuItem value="" disabled>
                                        No hay opciones para mostrar
                                    </MenuItem>
                                ) : (
                                    subjects.map((subject) => (
                                        <MenuItem key={subject._id} value={subject._id}>
                                            {subject.name}
                                        </MenuItem>
                                    ))
                                )}
                            </Select>
                        </FormControl>
                    )}

                    {!readOnly && (
                        <FormControl fullWidth sx={{ maxWidth: { md: 400 } }} disabled={loading || submitting}>
                            <InputLabel id="calendar-exam-type-label">Tipo de examen</InputLabel>
                            <Select
                                labelId="calendar-exam-type-label"
                                value={selectedExaminationTypeId}
                                label="Tipo de examen"
                                onChange={handleExaminationTypeChange}
                            >
                                {examinationTypes.map((type) => (
                                    <MenuItem key={type._id} value={type._id}>
                                        {type.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {readOnly
                        ? 'Visualiza el calendario de exámenes de la carrera.'
                        : 'Haz clic en un día para añadir un examen. Haz clic en un evento para eliminarlo.'}
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={{ height }}>
                        <Calendar<CalendarEvent>
                            localizer={localizer}
                            events={calendarEvents}
                            eventPropGetter={eventStyleGetter}
                            startAccessor="start"
                            endAccessor="end"
                            titleAccessor="title"
                            date={calendarDate}
                            view="month"
                            views={['month']}
                            selectable={!readOnly}
                            culture="es"
                            onNavigate={handleNavigate}
                            messages={{
                                today: 'Hoy',
                                previous: 'Anterior',
                                next: 'Siguiente',
                                month: 'Mes',
                                week: 'Semana',
                                day: 'Día',
                                agenda: 'Agenda',
                                date: 'Fecha',
                                time: 'Hora',
                                event: 'Evento',
                                noEventsInRange: 'No hay eventos en este rango'
                            }}
                            onSelectSlot={readOnly ? undefined : handleCreateEvent}
                            onSelectEvent={readOnly ? undefined : (selectedEvent) => {
                                const eventSubjectId = getEntityId(selectedEvent.resource.subjectId);
                                if (fixedSubjectId && eventSubjectId && fixedSubjectId !== eventSubjectId) {
                                    setError('No tienes los permisos para borrar este examen porque no pertenece a la asignatura especificada.');
                                    return;
                                }
                                setEventToDelete(selectedEvent);
                                setDeleteModalOpen(true);
                            }}
                        />
                    </Box>
                )}
            </CardContent>

            <ModalDialog
                open={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setEventToDelete(null);
                }}
                onConfirm={handleDeleteEvent}
                title="Eliminar examen del calendario"
                description="¿Estás seguro de que deseas eliminar este evento?"
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="error"
            />
        </Card>
    );
};

export default ExaminationCalendar;
