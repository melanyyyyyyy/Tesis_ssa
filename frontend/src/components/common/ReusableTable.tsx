import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    CircularProgress,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Tooltip,
    Typography,
    alpha,
    useTheme,
    type IconButtonProps
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    Visibility as VisibilityIcon
} from '@mui/icons-material';

const API_BASE = import.meta.env.VITE_API_BASE;

export interface ReusableTableColumn<T extends object> {
    field: keyof T | string;
    headerName: string;
    width?: number;
    renderCell?: (value: unknown, row: T) => React.ReactNode;
}

type ReusableTableActionVariant = 'view' | 'edit' | 'delete' | 'custom';

export interface ReusableTableAction<T extends object> {
    variant?: ReusableTableActionVariant;
    label: string;
    onClick: (row: T) => void;
    icon?: React.ReactNode;
    color?: IconButtonProps['color'];
    disabled?: (row: T) => boolean;
}

interface ReusableTableProps<T extends object> {
    endpoint: string;
    token?: string | null;
    columns: ReusableTableColumn<T>[];
    queryParams?: Record<string, string | number | boolean | null | undefined>;
    serverPagination?: boolean;
    rowsPerPageOptions?: number[];
    initialRowsPerPage?: number;
    emptyMessage?: string;
    tableAriaLabel?: string;
    refreshKey?: string | number;
    rowKey?: keyof T | ((row: T, index: number) => string | number);
    actions?: ReusableTableAction<T>[];
    extractRows?: (response: unknown) => T[];
    extractTotalCount?: (response: unknown, extractedRows: T[]) => number;
    onTotalCountChange?: (totalCount: number) => void;
    onUnauthorized?: () => void;
}

const getDefaultActionIcon = (variant: ReusableTableActionVariant = 'custom') => {
    if (variant === 'view') return <VisibilityIcon fontSize="small" />;
    if (variant === 'edit') return <EditIcon fontSize="small" />;
    if (variant === 'delete') return <DeleteIcon fontSize="small" />;
    return <VisibilityIcon fontSize="small" />;
};

const getDefaultActionColor = (variant: ReusableTableActionVariant = 'custom'): IconButtonProps['color'] => {
    if (variant === 'delete') return 'error';
    if (variant === 'edit') return 'primary';
    return 'default';
};

const buildUrl = (endpoint: string, queryString: string) => {
    const baseUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    if (!queryString) return baseUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${queryString}`;
};

const getFallbackRows = <T extends object>(response: unknown): T[] => {
    if (Array.isArray(response)) return response as T[];
    if (!response || typeof response !== 'object') return [];

    const parsed = response as Record<string, unknown>;
    const candidates = [
        parsed.data,
        parsed.items,
        parsed.rows,
        parsed.subjects,
        parsed.examinationTypes,
        parsed.notifications,
        parsed.events
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate as T[];
        }
    }

    return [];
};

const getFallbackTotalCount = <T extends object>(response: unknown, rows: T[]) => {
    if (!response || typeof response !== 'object') {
        return rows.length;
    }

    const parsed = response as Record<string, unknown>;
    if (typeof parsed.totalCount === 'number') return parsed.totalCount;
    if (typeof parsed.count === 'number') return parsed.count;
    if (typeof parsed.total === 'number') return parsed.total;
    return rows.length;
};

const ReusableTable = <T extends object>({
    endpoint,
    token,
    columns,
    queryParams,
    serverPagination = false,
    rowsPerPageOptions = [10, 25, 50, 100],
    initialRowsPerPage = 10,
    emptyMessage = 'No hay datos disponibles',
    tableAriaLabel = 'tabla reutilizable',
    refreshKey,
    rowKey,
    actions = [],
    extractRows,
    extractTotalCount,
    onTotalCountChange,
    onUnauthorized
}: ReusableTableProps<T>) => {
    const theme = useTheme();
    const [rows, setRows] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
    const [totalCount, setTotalCount] = useState(0);
    const extractRowsRef = useRef(extractRows);
    const extractTotalCountRef = useRef(extractTotalCount);
    const onUnauthorizedRef = useRef(onUnauthorized);

    useEffect(() => {
        extractRowsRef.current = extractRows;
    }, [extractRows]);

    useEffect(() => {
        extractTotalCountRef.current = extractTotalCount;
    }, [extractTotalCount]);

    useEffect(() => {
        onUnauthorizedRef.current = onUnauthorized;
    }, [onUnauthorized]);

    const serializedQueryParams = useMemo(() => {
        const params = new URLSearchParams();
        if (queryParams) {
            Object.entries(queryParams).forEach(([key, value]) => {
                if (value === undefined || value === null || value === '') {
                    return;
                }
                params.set(key, String(value));
            });
        }
        if (serverPagination) {
            params.set('page', String(page));
            params.set('limit', String(rowsPerPage));
        }
        return params.toString();
    }, [page, queryParams, rowsPerPage, serverPagination]);

    useEffect(() => {
        const abortController = new AbortController();

        const fetchRows = async () => {
            if (!token) {
                setRows([]);
                setTotalCount(0);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const response = await fetch(buildUrl(endpoint, serializedQueryParams), {
                    signal: abortController.signal,
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.status === 401) {
                    onUnauthorizedRef.current?.();
                    setRows([]);
                    setTotalCount(0);
                    setError('Tu sesión ha expirado. Inicia sesión nuevamente.');
                    return;
                }

                if (!response.ok) {
                    throw new Error('Error al obtener los datos de la tabla');
                }

                const result = await response.json();
                const extractedRows = extractRowsRef.current ? extractRowsRef.current(result) : getFallbackRows<T>(result);
                const extractedTotal = extractTotalCountRef.current
                    ? extractTotalCountRef.current(result, extractedRows)
                    : getFallbackTotalCount<T>(result, extractedRows);

                setRows(extractedRows);
                setTotalCount(serverPagination ? extractedTotal : extractedRows.length);
                setLoading(false);
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    return;
                }
                setRows([]);
                setTotalCount(0);
                setError(err instanceof Error ? err.message : 'Error desconocido');
                setLoading(false);
            }
        };

        void fetchRows();
        return () => {
            abortController.abort();
        };
    }, [
        endpoint,
        serializedQueryParams,
        token,
        serverPagination,
        refreshKey
    ]);

    useEffect(() => {
        onTotalCountChange?.(totalCount);
    }, [onTotalCountChange, totalCount]);

    useEffect(() => {
        if (serverPagination) return;
        const maxPage = Math.max(0, Math.ceil(totalCount / rowsPerPage) - 1);
        if (page > maxPage) {
            setPage(maxPage);
        }
    }, [page, rowsPerPage, serverPagination, totalCount]);

    const visibleRows = useMemo(() => {
        if (serverPagination) {
            return rows;
        }
        const start = page * rowsPerPage;
        const end = start + rowsPerPage;
        return rows.slice(start, end);
    }, [page, rows, rowsPerPage, serverPagination]);

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const hasActions = actions.length > 0;
    const viewAction = useMemo(
        () => actions.find((action) => {
            const label = action.label.toLowerCase();
            return action.variant === 'view' || label.includes('ver más') || label.includes('ver mas');
        }),
        [actions]
    );
    const baseColumnCount = columns.length + 1;
    const totalColumnCount = hasActions ? baseColumnCount + 1 : baseColumnCount;
    const isInitialLoading = loading && rows.length === 0;

    return (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

            {isInitialLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    <Table sx={{ minWidth: 650 }} aria-label={tableAriaLabel}>
                        <TableHead>
                            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                                <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                                {columns.map((column) => (
                                    <TableCell
                                        key={String(column.field)}
                                        sx={{
                                            fontWeight: 600,
                                            minWidth: column.width || 'auto',
                                        }}
                                    >
                                        {column.headerName}
                                    </TableCell>
                                ))}
                                {hasActions && (
                                    <TableCell align="center" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        Acciones
                                    </TableCell>
                                )}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visibleRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={totalColumnCount} align="center" sx={{ py: 3 }}>
                                        <Typography color="text.secondary">{emptyMessage}</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                visibleRows.map((row, index) => {
                                    const rowRecord = row as Record<string, unknown>;
                                    const resolvedRowKey =
                                        typeof rowKey === 'function'
                                            ? rowKey(row, index)
                                            : rowKey
                                                ? String(rowRecord[String(rowKey)])
                                                : `${page}-${index}`;

                                    return (
                                        <TableRow
                                            key={resolvedRowKey}
                                            onClick={() => {
                                                if (!viewAction) return;
                                                if (viewAction.disabled?.(row)) return;
                                                viewAction.onClick(row);
                                            }}
                                            sx={{
                                                '&:last-child td, &:last-child th': { border: 0 },
                                                '&:hover': {
                                                    bgcolor: 'rgba(44, 62, 80, 0.125)',
                                                    transition: 'background-color 0.2s ease' 
                                                },
                                                cursor: viewAction ? 'pointer' : 'default'
                                            }}
                                        >
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={500}>
                                                    {page * rowsPerPage + index + 1}
                                                </Typography>
                                            </TableCell>
                                            {columns.map((column) => (
                                                <TableCell key={String(column.field)}>
                                                    <Typography variant="body2" fontWeight={500}>
                                                        {column.renderCell
                                                            ? column.renderCell(rowRecord[String(column.field)], row)
                                                            : (rowRecord[String(column.field)] as React.ReactNode) || '—'
                                                        }
                                                    </Typography>
                                                </TableCell>
                                            ))}
                                            {hasActions && (
                                                <TableCell align="center">
                                                    <Stack direction="row" spacing={0.5} justifyContent="center">
                                                        {actions.map((action) => {
                                                            const variant = action.variant || 'custom';
                                                            const actionColor = action.color || getDefaultActionColor(variant);
                                                            return (
                                                                <Tooltip key={action.label} title={action.label}>
                                                                    <span>
                                                                        <IconButton
                                                                            size="small"
                                                                            color={actionColor}
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                action.onClick(row);
                                                                            }}
                                                                            disabled={action.disabled ? action.disabled(row) : false}
                                                                        >
                                                                            {action.icon || getDefaultActionIcon(variant)}
                                                                        </IconButton>
                                                                    </span>
                                                                </Tooltip>
                                                            );
                                                        })}
                                                    </Stack>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                    <TablePagination
                        rowsPerPageOptions={rowsPerPageOptions}
                        component="div"
                        count={totalCount}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        labelRowsPerPage="Filas por página:"
                        labelDisplayedRows={({ from, to, count }) =>
                            `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
                        }
                    />
                </>
            )}
        </TableContainer>
    );
};

export default ReusableTable;
