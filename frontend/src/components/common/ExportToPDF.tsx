import React, { useState } from 'react';
import Button from '@mui/material/Button';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReusableTableColumn } from './ReusableTable';

const API_BASE = import.meta.env.VITE_API_BASE;

type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface ExportTableConfig<T extends object = Record<string, unknown>> {
    title: string;
    endpoint: string;
    columns: ReusableTableColumn<T>[];
    queryParams?: QueryParams;
    extractRows?: (response: unknown) => T[];
}

interface ExportToPDFProps {
    token?: string | null;
    tables: Array<ExportTableConfig<any>>;
    fileName?: string;
    buttonLabel?: string;
    disabled?: boolean;
    logoUrl?: string;
    institutionName?: string;
    reportSubtitle?: string;
    onUnauthorized?: () => void;
    onError?: (message: string) => void;
}

const PDF_THEME = {
    primary: [28, 43, 93] as [number, number, number], // #1C2B5D
    secondary: [112, 173, 71] as [number, number, number], // #70AD47
    textPrimary: [44, 62, 80] as [number, number, number], // #2c3e50
    textSecondary: [127, 140, 141] as [number, number, number], // #7f8c8d
    tableAlt: [245, 245, 245] as [number, number, number] // #f5f5f5
};

const buildUrl = (endpoint: string, queryParams?: QueryParams) => {
    const baseUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    if (!queryParams) return baseUrl;

    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
    });

    const queryString = params.toString();
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

const normalizeCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (value instanceof Date) return value.toLocaleDateString('es-ES');

    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        if (typeof record.name === 'string') return record.name;
        if (typeof record.value === 'string') return record.value;
        if (typeof record.title === 'string') return record.title;
    }

    return String(value);
};

const normalizeRenderedCell = (value: unknown) => {
    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return normalizeCellValue(value);
    }
    return '';
};

const imageToDataUrl = async (imageUrl: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' }> => {
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error('No se pudo cargar el logo para el PDF.');
    }
    const blob = await response.blob();
    const mime = (blob.type || '').toLowerCase();

    if (mime.includes('svg')) {
        const objectUrl = URL.createObjectURL(blob);
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const image = new Image();
                image.onload = () => {
                    const width = image.naturalWidth || 600;
                    const height = image.naturalHeight || 180;
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const context = canvas.getContext('2d');
                    if (!context) {
                        reject(new Error('No se pudo procesar el logo SVG para el PDF.'));
                        return;
                    }
                    context.drawImage(image, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/png'));
                };
                image.onerror = () => reject(new Error('No se pudo convertir el logo SVG para el PDF.'));
                image.src = objectUrl;
            });
            return { dataUrl, format: 'PNG' };
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }

    const format: 'PNG' | 'JPEG' = mime.includes('png') || mime.includes('webp') ? 'PNG' : 'JPEG';

    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('No se pudo leer el logo para el PDF.'));
        reader.readAsDataURL(blob);
    });

    return { dataUrl, format };
};

const getImageAspectRatio = async (dataUrl: string): Promise<number> => {
    return await new Promise<number>((resolve) => {
        const image = new Image();
        image.onload = () => {
            const width = image.naturalWidth || 1;
            const height = image.naturalHeight || 1;
            resolve(width / height);
        };
        image.onerror = () => resolve(1);
        image.src = dataUrl;
    });
};

const loadLogoWithFallback = async (preferredLogoUrl?: string) => {
    const candidates = [
        preferredLogoUrl,
        '/images/uho-blue.png',
        '/images/university-logo.png',
        '/images/university-logo.jpg',
        '/images/university-logo.jpeg',
        '/images/uho-blue.svg'
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
        try {
            return await imageToDataUrl(candidate);
        } catch {
            // 
        }
    }
    return null;
};

const ExportToPDF: React.FC<ExportToPDFProps> = ({
    token,
    tables,
    fileName = 'reporte.pdf',
    buttonLabel = 'Exportar a PDF',
    disabled = false,
    logoUrl = '/images/uho-blue.png',
    institutionName = '',
    reportSubtitle,
    onUnauthorized,
    onError
}) => {
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        if (exporting || disabled || tables.length === 0) return;

        setExporting(true);
        try {
            const logo = await loadLogoWithFallback(logoUrl);
            const logoAspectRatio = logo?.dataUrl ? await getImageAspectRatio(logo.dataUrl) : 1;
            const fetchedTables = await Promise.all(
                tables.map(async (table) => {
                    const response = await fetch(buildUrl(table.endpoint, table.queryParams), {
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined
                    });

                    if (response.status === 401) {
                        onUnauthorized?.();
                        throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');
                    }

                    if (!response.ok) {
                        throw new Error(`No se pudieron obtener los datos de "${table.title}"`);
                    }

                    const result = await response.json();
                    const rows = table.extractRows
                        ? table.extractRows(result)
                        : getFallbackRows<any>(result);

                    return {
                        ...table,
                        rows
                    };
                })
            );

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            let currentY = 14;

            fetchedTables.forEach((table, index) => {
                if (index > 0) {
                    doc.addPage();
                    currentY = 14;
                }

                doc.setFont('helvetica', 'normal');
                let headerBottomY = currentY + 8;
                if (logo?.dataUrl) {
                    const maxLogoWidth = 34;
                    const maxLogoHeight = 18;
                    let drawWidth = maxLogoWidth;
                    let drawHeight = drawWidth / logoAspectRatio;
                    if (drawHeight > maxLogoHeight) {
                        drawHeight = maxLogoHeight;
                        drawWidth = drawHeight * logoAspectRatio;
                    }
                    doc.addImage(logo.dataUrl, logo.format, 14, currentY, drawWidth, drawHeight);
                    headerBottomY = Math.max(headerBottomY, currentY + drawHeight + 4);
                }

                if (institutionName.trim()) {
                    doc.setTextColor(...PDF_THEME.primary);
                    doc.setFontSize(14);
                    doc.text(institutionName, 14, headerBottomY + 5);
                    headerBottomY += 5;
                }
                if (reportSubtitle?.trim()) {
                    doc.setTextColor(...PDF_THEME.textSecondary);
                    doc.setFontSize(10);
                    doc.text(reportSubtitle, 14, headerBottomY + 5);
                    headerBottomY += 5;
                }

                doc.setTextColor(...PDF_THEME.primary);
                doc.setDrawColor(...PDF_THEME.secondary);
                doc.setLineWidth(0.6);
                doc.line(14, headerBottomY + 3, 196, headerBottomY + 3);

                doc.setTextColor(...PDF_THEME.textPrimary);
                doc.setFontSize(12);
                doc.text(table.title, 14, headerBottomY + 11);

                const headers = table.columns.map((column) => column.headerName);
                const body = table.rows.length > 0
                    ? table.rows.map((row) => {
                        const rowRecord = row as Record<string, unknown>;
                        return table.columns.map((column) => {
                            const rawValue = rowRecord[String(column.field)];
                            if (column.renderCell) {
                                const rendered = column.renderCell(rawValue, row);
                                const renderedText = normalizeRenderedCell(rendered);
                                if (renderedText) return renderedText;
                            }
                            return normalizeCellValue(rawValue);
                        });
                    })
                    : [table.columns.map((_column, columnIndex) => (columnIndex === 0 ? 'Sin datos' : ''))];

                autoTable(doc, {
                    startY: headerBottomY + 15,
                    head: [headers],
                    body,
                    styles: {
                        fontSize: 9,
                        cellPadding: 2,
                        textColor: PDF_THEME.textPrimary,
                        lineColor: [230, 230, 230],
                        lineWidth: 0.1
                    },
                    headStyles: {
                        fillColor: PDF_THEME.primary,
                        textColor: [255, 255, 255],
                        fontStyle: 'bold'
                    },
                    alternateRowStyles: {
                        fillColor: PDF_THEME.tableAlt
                    }
                });
            });

            doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'No se pudo exportar el PDF.';
            onError?.(message);
        } finally {
            setExporting(false);
        }
    };

    return (
        <Button
            variant="contained"
            color="error"
            startIcon={<PictureAsPdfIcon />}
            onClick={() => { void handleExport(); }}
            disabled={disabled || exporting || tables.length === 0}
        >
            {exporting ? 'Exportando...' : buttonLabel}
        </Button>
    );
};

export default ExportToPDF;
