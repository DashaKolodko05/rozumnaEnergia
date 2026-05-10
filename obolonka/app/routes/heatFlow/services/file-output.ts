import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export function exportToJSON(data: any) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
    });

    downloadFile(blob, 'simulation.json');
}

export function exportToCSV(data: any[]) {
    if (!data.length) return;

    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
        headers.map(h => row[h]).join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });

    downloadFile(blob, 'simulation.csv');
}

export function exportToTXT(data: any[]) {
    const text = data.map(row => JSON.stringify(row)).join('\n');

    const blob = new Blob([text], { type: 'text/plain' });

    downloadFile(blob, 'simulation.txt');
}

export async function exportToXLSX(data: any[]) {
    if (!data?.length) return;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Simulation');

    sheet.columns = Object.keys(data[0]).map(key => ({
        header: key,
        key,
        width: 15,
    }));

    data.forEach(row => sheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer]);

    downloadFile(blob, 'simulation.xlsx');
}


export async function exportToPDF(elementId: string) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');

    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save('simulation.pdf');
}

function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}
