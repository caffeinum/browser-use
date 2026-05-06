import fsSync from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import PDFDocument from 'pdfkit';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
export async function extractPdfText(buffer) {
    const pdfParseModule = (await import('pdf-parse'));
    if (typeof pdfParseModule.default === 'function') {
        const legacyParser = pdfParseModule.default;
        const parsed = await legacyParser(buffer);
        return {
            text: parsed.text ?? '',
            totalPages: parsed.numpages ?? 0,
        };
    }
    if (typeof pdfParseModule.PDFParse === 'function') {
        const Parser = pdfParseModule.PDFParse;
        const parser = new Parser({ data: buffer });
        try {
            const parsed = await parser.getText();
            return {
                text: parsed.text ?? '',
                totalPages: parsed.total ?? 0,
            };
        }
        finally {
            if (typeof parser.destroy === 'function') {
                await parser.destroy();
            }
        }
    }
    throw new FileSystemError("Error: Could not parse PDF file due to unsupported 'pdf-parse' module format.");
}
export async function extractPdfTextByPage(buffer) {
    const pdfParseModule = (await import('pdf-parse'));
    if (typeof pdfParseModule.PDFParse === 'function') {
        const Parser = pdfParseModule.PDFParse;
        const parser = new Parser({ data: buffer });
        try {
            let numPages = 0;
            try {
                const info = await parser.getInfo?.({ parsePageInfo: false });
                numPages = Number(info?.total ?? 0);
            }
            catch {
                numPages = 0;
            }
            if (!Number.isFinite(numPages) || numPages <= 0) {
                const full = await parser.getText();
                const text = typeof full?.text === 'string' ? full.text : '';
                return {
                    numPages: 1,
                    pageTexts: [text],
                    totalChars: text.length,
                };
            }
            const pageTexts = [];
            let totalChars = 0;
            for (let pageNumber = 1; pageNumber <= numPages; pageNumber += 1) {
                const pageResult = await parser.getText({ partial: [pageNumber] });
                const text = typeof pageResult?.text === 'string' ? pageResult.text : '';
                pageTexts.push(text);
                totalChars += text.length;
            }
            return {
                numPages,
                pageTexts,
                totalChars,
            };
        }
        finally {
            if (typeof parser.destroy === 'function') {
                await parser.destroy();
            }
        }
    }
    const parsed = await extractPdfText(buffer);
    const text = parsed.text ?? '';
    return {
        numPages: Math.max(parsed.totalPages, 1),
        pageTexts: [text],
        totalChars: text.length,
    };
}
export const INVALID_FILENAME_ERROR_MESSAGE = 'Error: Invalid filename format. Must be alphanumeric with supported extension.';
export const DEFAULT_FILE_SYSTEM_PATH = 'browseruse_agent_data';
const UNSUPPORTED_BINARY_EXTENSIONS = new Set([
    'png',
    'jpg',
    'jpeg',
    'gif',
    'bmp',
    'svg',
    'webp',
    'ico',
    'mp3',
    'mp4',
    'wav',
    'avi',
    'mov',
    'zip',
    'tar',
    'gz',
    'rar',
    'exe',
    'bin',
    'dll',
    'so',
]);
const DEFAULT_EXTENSIONS = [
    'md',
    'txt',
    'json',
    'jsonl',
    'csv',
    'pdf',
    'docx',
    'html',
    'xml',
];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const buildFilenameRegex = (extensions) => new RegExp(`^[a-zA-Z0-9_\\-.() \\u4e00-\\u9fff]+\\.(${extensions.map(escapeRegex).join('|')})$`);
const buildFilenameErrorMessage = (fileName, supportedExtensions) => {
    const base = path.basename(fileName);
    const supported = supportedExtensions.map((ext) => `.${ext}`).join(', ');
    if (base.includes('.')) {
        const ext = base.slice(base.lastIndexOf('.') + 1).toLowerCase();
        if (UNSUPPORTED_BINARY_EXTENSIONS.has(ext)) {
            return (`Error: Cannot write binary/image file '${base}'. ` +
                'The write_file tool only supports text-based files. ' +
                `Supported extensions: ${supported}. ` +
                'For screenshots, the browser automatically captures them - do not try to save screenshots as files.');
        }
        if (!supportedExtensions.includes(ext)) {
            return (`Error: Unsupported file extension '.${ext}' in '${base}'. ` +
                `Supported extensions: ${supported}. ` +
                'Please rename the file to use a supported extension.');
        }
    }
    else {
        return (`Error: Filename '${base}' has no extension. ` +
            `Please add a supported extension: ${supported}.`);
    }
    return (`Error: Invalid filename '${base}'. ` +
        'Filenames must contain only letters, numbers, underscores, hyphens, dots, parentheses, and spaces. ' +
        `Supported extensions: ${supported}.`);
};
const escapeXmlText = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const decodeXmlText = (value) => value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
const DOCX_CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
const DOCX_ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
const DOCX_DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
const buildDocxDocumentXml = (content) => {
    const lines = content.split(/\r?\n/);
    const paragraphs = lines
        .map((line) => {
        if (!line) {
            return '<w:p/>';
        }
        return `<w:p><w:r><w:t xml:space="preserve">${escapeXmlText(line)}</w:t></w:r></w:p>`;
    })
        .join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 wp14">
  <w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;
};
const buildDocxBuffer = (content) => {
    const zip = new AdmZip();
    zip.addFile('[Content_Types].xml', Buffer.from(DOCX_CONTENT_TYPES_XML, 'utf-8'));
    zip.addFile('_rels/.rels', Buffer.from(DOCX_ROOT_RELS_XML, 'utf-8'));
    zip.addFile('word/_rels/document.xml.rels', Buffer.from(DOCX_DOCUMENT_RELS_XML, 'utf-8'));
    zip.addFile('word/document.xml', Buffer.from(buildDocxDocumentXml(content), 'utf-8'));
    return zip.toBuffer();
};
const readDocxText = (fileBuffer) => {
    const zip = new AdmZip(fileBuffer);
    const documentEntry = zip.getEntry('word/document.xml');
    if (!documentEntry) {
        throw new FileSystemError('Error: Could not parse DOCX file content.');
    }
    const xml = documentEntry.getData().toString('utf-8');
    const normalizedXml = xml.replace(/<w:p\b([^>]*)\/>/g, '<w:p$1></w:p>');
    const paragraphMatches = normalizedXml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];
    const lines = paragraphMatches.map((paragraph) => {
        const textMatches = Array.from(paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g));
        if (!textMatches.length) {
            return '';
        }
        return textMatches.map((match) => decodeXmlText(match[1] ?? '')).join('');
    });
    return lines.join('\n').trim();
};
export class FileSystemError extends Error {
}
class BaseFile {
    name;
    content;
    constructor(name, content = '') {
        this.name = name;
        this.content = content;
    }
    get fullName() {
        return `${this.name}.${this.extension}`;
    }
    get size() {
        return this.content.length;
    }
    get lineCount() {
        return this.content ? this.content.split(/\r?\n/).length : 0;
    }
    writeFileContent(content) {
        this.content = content;
    }
    appendFileContent(content) {
        this.content = `${this.content}${content}`;
    }
    read() {
        return this.content;
    }
    async syncToDisk(dir) {
        await fsp.writeFile(path.join(dir, this.fullName), this.content, 'utf-8');
    }
    syncToDiskSync(dir) {
        fsSync.writeFileSync(path.join(dir, this.fullName), this.content, 'utf-8');
    }
    async write(content, dir) {
        this.writeFileContent(content);
        await this.syncToDisk(dir);
    }
    writeSync(content, dir) {
        this.writeFileContent(content);
        this.syncToDiskSync(dir);
    }
    async append(content, dir) {
        this.appendFileContent(content);
        await this.syncToDisk(dir);
    }
    appendSync(content, dir) {
        this.appendFileContent(content);
        this.syncToDiskSync(dir);
    }
    toJSON() {
        return { name: this.name, content: this.content };
    }
}
class MarkdownFile extends BaseFile {
    get extension() {
        return 'md';
    }
}
class TxtFile extends BaseFile {
    get extension() {
        return 'txt';
    }
}
class JsonFile extends BaseFile {
    get extension() {
        return 'json';
    }
}
class JsonlFile extends BaseFile {
    get extension() {
        return 'jsonl';
    }
}
class CsvFile extends BaseFile {
    get extension() {
        return 'csv';
    }
}
class PdfFile extends BaseFile {
    get extension() {
        return 'pdf';
    }
    async syncToDisk(dir) {
        const filePath = path.join(dir, this.fullName);
        await new Promise((resolve, reject) => {
            const doc = new PDFDocument({ autoFirstPage: true });
            const stream = fsSync.createWriteStream(filePath);
            doc.pipe(stream);
            doc.fontSize(12).text(this.content || '', { width: 500, align: 'left' });
            doc.end();
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
    }
    syncToDiskSync(dir) {
        const filePath = path.join(dir, this.fullName);
        const script = `
const { createWriteStream } = require('fs');
const PDFDocument = require(${JSON.stringify(require.resolve('pdfkit'))});
const filePath = ${JSON.stringify(filePath)};
const content = ${JSON.stringify(this.content ?? '')};
const doc = new PDFDocument({ autoFirstPage: true });
const stream = createWriteStream(filePath);
doc.pipe(stream);
doc.fontSize(12).text(content || '', { width: 500, align: 'left' });
doc.end();
stream.on('finish', () => process.exit(0));
stream.on('error', (err) => {
	console.error(err);
	process.exit(1);
});
`;
        const result = spawnSync(process.execPath, ['-e', script], {
            stdio: ['ignore', 'ignore', 'pipe'],
        });
        if (result.status !== 0) {
            const errorMsg = result.stderr?.toString() ||
                `Could not write to file '${this.fullName}'.`;
            throw new FileSystemError(`Error: ${errorMsg.trim()}`);
        }
    }
}
class DocxFile extends BaseFile {
    get extension() {
        return 'docx';
    }
    async syncToDisk(dir) {
        const filePath = path.join(dir, this.fullName);
        const docxBuffer = buildDocxBuffer(this.content || '');
        await fsp.writeFile(filePath, docxBuffer);
    }
    syncToDiskSync(dir) {
        const filePath = path.join(dir, this.fullName);
        const docxBuffer = buildDocxBuffer(this.content || '');
        fsSync.writeFileSync(filePath, docxBuffer);
    }
}
class HtmlFile extends BaseFile {
    get extension() {
        return 'html';
    }
}
class XmlFile extends BaseFile {
    get extension() {
        return 'xml';
    }
}
const FILE_TYPES = {
    md: MarkdownFile,
    txt: TxtFile,
    json: JsonFile,
    jsonl: JsonlFile,
    csv: CsvFile,
    pdf: PdfFile,
    docx: DocxFile,
    html: HtmlFile,
    xml: XmlFile,
};
const TYPE_NAME_MAP = {
    MarkdownFile,
    TxtFile,
    JsonFile,
    JsonlFile,
    CsvFile,
    PdfFile,
    DocxFile,
    HtmlFile,
    XmlFile,
};
export class FileSystem {
    files = new Map();
    defaultFiles = ['todo.md'];
    baseDir;
    dataDir;
    extractedContentCount = 0;
    constructor(baseDir, createDefaultFiles = true) {
        this.baseDir = path.resolve(baseDir);
        fsSync.mkdirSync(this.baseDir, { recursive: true });
        this.dataDir = path.join(this.baseDir, DEFAULT_FILE_SYSTEM_PATH);
        if (fsSync.existsSync(this.dataDir)) {
            fsSync.rmSync(this.dataDir, { recursive: true, force: true });
        }
        fsSync.mkdirSync(this.dataDir, { recursive: true });
        if (createDefaultFiles) {
            this.createDefaultFiles();
        }
    }
    createDefaultFiles() {
        for (const filename of this.defaultFiles) {
            const file = this.instantiateFile(filename);
            this.files.set(filename, file);
            fsSync.writeFileSync(path.join(this.dataDir, filename), file.read(), 'utf-8');
        }
    }
    isValidFilename(filename) {
        const base = path.basename(filename);
        const regex = buildFilenameRegex(this.get_allowed_extensions());
        if (!regex.test(base)) {
            return false;
        }
        const idx = base.lastIndexOf('.');
        if (idx <= 0) {
            return false;
        }
        return base.slice(0, idx).trim().length > 0;
    }
    static sanitize_filename(fileName) {
        const base = path.basename(fileName);
        const idx = base.lastIndexOf('.');
        if (idx === -1) {
            return base;
        }
        const ext = base.slice(idx + 1).toLowerCase();
        let namePart = base.slice(0, idx);
        namePart = namePart.replace(/ /g, '-');
        namePart = namePart.replace(/[^a-zA-Z0-9_\-.()\u4e00-\u9fff]/g, '');
        namePart = namePart.replace(/-{2,}/g, '-');
        namePart = namePart.replace(/^[-.]+|[-.]+$/g, '');
        if (!namePart) {
            namePart = 'file';
        }
        return `${namePart}.${ext}`;
    }
    resolveFilename(filename) {
        const base = path.basename(filename);
        const wasChanged = base !== filename;
        if (this.isValidFilename(base)) {
            return [base, wasChanged];
        }
        const sanitized = FileSystem.sanitize_filename(base);
        if (sanitized !== base && this.isValidFilename(sanitized)) {
            return [sanitized, true];
        }
        return [base, wasChanged];
    }
    parseFilename(filename) {
        const idx = filename.lastIndexOf('.');
        if (idx === -1) {
            throw new FileSystemError(INVALID_FILENAME_ERROR_MESSAGE);
        }
        const name = filename.slice(0, idx);
        const extension = filename.slice(idx + 1).toLowerCase();
        return [name, extension];
    }
    getFileClass(extension) {
        return FILE_TYPES[extension];
    }
    instantiateFile(fullFilename, content = '') {
        const [name, extension] = this.parseFilename(fullFilename);
        const FileCtor = this.getFileClass(extension);
        if (!FileCtor) {
            throw new FileSystemError(INVALID_FILENAME_ERROR_MESSAGE);
        }
        return new FileCtor(name, content);
    }
    get_allowed_extensions() {
        return Object.keys(FILE_TYPES);
    }
    get_dir() {
        return this.dataDir;
    }
    get_file(filename) {
        const [resolved] = this.resolveFilename(filename);
        if (!this.isValidFilename(resolved)) {
            return null;
        }
        return this.files.get(resolved) ?? null;
    }
    list_files() {
        return Array.from(this.files.values()).map((file) => file.fullName);
    }
    display_file(filename) {
        const [resolved] = this.resolveFilename(filename);
        if (!this.isValidFilename(resolved)) {
            return null;
        }
        const file = this.files.get(resolved) ?? null;
        return file ? file.read() : null;
    }
    async read_file_structured(filename, externalFile = false) {
        const result = {
            message: '',
            images: null,
        };
        if (externalFile) {
            try {
                const base = path.basename(filename);
                const idx = base.lastIndexOf('.');
                if (idx === -1) {
                    result.message =
                        `Error: Invalid filename format ${filename}. ` +
                            'Must be alphanumeric with a supported extension.';
                    return result;
                }
                const extension = base.slice(idx + 1).toLowerCase();
                const specialExtensions = new Set([
                    'docx',
                    'pdf',
                    'jpg',
                    'jpeg',
                    'png',
                ]);
                const textExtensions = this.get_allowed_extensions().filter((ext) => !specialExtensions.has(ext));
                if (textExtensions.includes(extension)) {
                    const content = await fsp.readFile(filename, 'utf-8');
                    result.message = `Read from file ${filename}.\n<content>\n${content}\n</content>`;
                    return result;
                }
                if (extension === 'pdf') {
                    const MAX_CHARS = 60000;
                    const buffer = await fsp.readFile(filename);
                    const pdf = await extractPdfTextByPage(buffer);
                    const numPages = pdf.numPages;
                    const pageTexts = pdf.pageTexts;
                    const totalChars = pdf.totalChars;
                    if (totalChars <= MAX_CHARS) {
                        const contentParts = [];
                        for (let pageNumber = 1; pageNumber <= pageTexts.length; pageNumber += 1) {
                            const text = pageTexts[pageNumber - 1] ?? '';
                            if (!text.trim()) {
                                continue;
                            }
                            contentParts.push(`--- Page ${pageNumber} ---\n${text}`);
                        }
                        result.message =
                            `Read from file ${filename} (${numPages} pages, ${totalChars.toLocaleString()} chars).\n` +
                                `<content>\n${contentParts.join('\n\n')}\n</content>`;
                        return result;
                    }
                    const wordToPages = new Map();
                    const pageWords = new Map();
                    for (let pageNumber = 1; pageNumber <= pageTexts.length; pageNumber += 1) {
                        const text = pageTexts[pageNumber - 1] ?? '';
                        const words = new Set((text.toLowerCase().match(/\b[a-zA-Z]{4,}\b/g) ?? []).map((word) => word));
                        pageWords.set(pageNumber, words);
                        for (const word of words) {
                            if (!wordToPages.has(word)) {
                                wordToPages.set(word, new Set());
                            }
                            wordToPages.get(word).add(pageNumber);
                        }
                    }
                    const pageScores = new Map();
                    for (const [pageNumber, words] of pageWords.entries()) {
                        let score = 0;
                        for (const word of words) {
                            const pagesWithWord = wordToPages.get(word)?.size ?? 1;
                            score += Math.log(Math.max(numPages, 1) / pagesWithWord);
                        }
                        pageScores.set(pageNumber, score);
                    }
                    const priorityPages = [1];
                    const sortedPages = Array.from(pageScores.entries()).sort((a, b) => b[1] - a[1]);
                    for (const [pageNumber] of sortedPages) {
                        if (!priorityPages.includes(pageNumber)) {
                            priorityPages.push(pageNumber);
                        }
                    }
                    for (let pageNumber = 1; pageNumber <= numPages; pageNumber += 1) {
                        if (!priorityPages.includes(pageNumber)) {
                            priorityPages.push(pageNumber);
                        }
                    }
                    const contentParts = [];
                    let charsUsed = 0;
                    const pagesIncluded = [];
                    const pagesIncludedSet = new Set();
                    for (const pageNumber of priorityPages) {
                        const text = pageTexts[pageNumber - 1] ?? '';
                        if (!text.trim()) {
                            continue;
                        }
                        const pageHeader = `--- Page ${pageNumber} ---\n`;
                        const truncationSuffix = '\n[...truncated]';
                        const remaining = MAX_CHARS - charsUsed;
                        const minUseful = pageHeader.length + truncationSuffix.length + 50;
                        if (remaining < minUseful) {
                            break;
                        }
                        let pageContent = `${pageHeader}${text}`;
                        if (pageContent.length > remaining) {
                            pageContent =
                                pageContent.slice(0, Math.max(0, remaining - truncationSuffix.length)) + truncationSuffix;
                        }
                        contentParts.push({ pageNumber, content: pageContent });
                        charsUsed += pageContent.length;
                        pagesIncluded.push(pageNumber);
                        pagesIncludedSet.add(pageNumber);
                        if (charsUsed >= MAX_CHARS) {
                            break;
                        }
                    }
                    contentParts.sort((a, b) => a.pageNumber - b.pageNumber);
                    const extractedText = contentParts
                        .map((part) => part.content)
                        .join('\n\n');
                    let truncationNote = '';
                    const pagesNotShown = numPages - pagesIncluded.length;
                    if (pagesNotShown > 0) {
                        const skipped = [];
                        for (let pageNumber = 1; pageNumber <= numPages; pageNumber += 1) {
                            if (!pagesIncludedSet.has(pageNumber)) {
                                skipped.push(pageNumber);
                            }
                        }
                        const skippedPreview = skipped.slice(0, 10).join(', ');
                        const skippedSuffix = skipped.length > 10 ? ', ...' : '';
                        truncationNote =
                            `\n\n[Showing ${pagesIncluded.length} of ${numPages} pages. ` +
                                `Skipped pages: [${skippedPreview}${skippedSuffix}]. ` +
                                'Use extract with start_from_char to read further into the file.]';
                    }
                    result.message =
                        `Read from file ${filename} (${numPages} pages, ${totalChars.toLocaleString()} chars total).\n` +
                            `<content>\n${extractedText}${truncationNote}\n</content>`;
                    return result;
                }
                if (extension === 'docx') {
                    const fileBuffer = await fsp.readFile(filename);
                    const content = readDocxText(fileBuffer);
                    result.message = `Read from file ${filename}.\n<content>\n${content}\n</content>`;
                    return result;
                }
                if (extension === 'jpg' ||
                    extension === 'jpeg' ||
                    extension === 'png') {
                    const fileBuffer = await fsp.readFile(filename);
                    result.message = `Read image file ${filename}.`;
                    result.images = [
                        {
                            name: base,
                            data: fileBuffer.toString('base64'),
                        },
                    ];
                    return result;
                }
                result.message = `Error: Cannot read file ${filename} as ${extension} extension is not supported.`;
                return result;
            }
            catch (error) {
                if (error?.code === 'ENOENT') {
                    result.message = `Error: File '${filename}' not found.`;
                    return result;
                }
                if (error?.code === 'EACCES') {
                    result.message = `Error: Permission denied to read file '${filename}'.`;
                    return result;
                }
                result.message =
                    `Error: Could not read file '${filename}'. ${error instanceof Error ? error.message : ''}`.trim();
                return result;
            }
        }
        const originalFilename = filename;
        const [resolved, wasSanitized] = this.resolveFilename(filename);
        if (!this.isValidFilename(resolved)) {
            result.message = buildFilenameErrorMessage(filename, this.get_allowed_extensions());
            return result;
        }
        const file = this.files.get(resolved) ?? null;
        if (!file) {
            if (wasSanitized) {
                result.message =
                    `File '${resolved}' not found. ` +
                        `(Filename was auto-corrected from '${originalFilename}')`;
            }
            else {
                result.message = `File '${originalFilename}' not found.`;
            }
            return result;
        }
        try {
            const content = file.read();
            const sanitizeNote = wasSanitized
                ? `Note: filename was auto-corrected from '${originalFilename}' to '${resolved}'. `
                : '';
            result.message = `${sanitizeNote}Read from file ${resolved}.\n<content>\n${content}\n</content>`;
            return result;
        }
        catch (error) {
            result.message =
                error instanceof FileSystemError
                    ? error.message
                    : `Error: Could not read file '${originalFilename}'.`;
            return result;
        }
    }
    async read_file(filename, externalFile = false) {
        const result = await this.read_file_structured(filename, externalFile);
        return result.message;
    }
    async write_file(filename, content) {
        const originalFilename = filename;
        const [resolved, wasSanitized] = this.resolveFilename(filename);
        if (!this.isValidFilename(resolved)) {
            return buildFilenameErrorMessage(filename, this.get_allowed_extensions());
        }
        filename = resolved;
        const file = this.files.get(filename) ?? this.instantiateFile(filename);
        this.files.set(filename, file);
        try {
            await file.write(content, this.dataDir);
            const sanitizeNote = wasSanitized
                ? ` (auto-corrected from '${originalFilename}')`
                : '';
            return `Data written to file ${filename} successfully.${sanitizeNote}`;
        }
        catch (error) {
            return `Error: Could not write to file '${filename}'. ${error.message}`;
        }
    }
    async append_file(filename, content) {
        const originalFilename = filename;
        const [resolved, wasSanitized] = this.resolveFilename(filename);
        if (!this.isValidFilename(resolved)) {
            return buildFilenameErrorMessage(filename, this.get_allowed_extensions());
        }
        filename = resolved;
        const file = this.get_file(filename);
        if (!file) {
            if (wasSanitized) {
                return (`File '${filename}' not found. ` +
                    `(Filename was auto-corrected from '${originalFilename}')`);
            }
            return `File '${filename}' not found.`;
        }
        try {
            await file.append(content, this.dataDir);
            const sanitizeNote = wasSanitized
                ? ` (auto-corrected from '${originalFilename}')`
                : '';
            return `Data appended to file ${filename} successfully.${sanitizeNote}`;
        }
        catch (error) {
            return `Error: Could not append to file '${filename}'. ${error.message}`;
        }
    }
    async replace_file_str(filename, oldStr, newStr) {
        const originalFilename = filename;
        const [resolved, wasSanitized] = this.resolveFilename(filename);
        if (!this.isValidFilename(resolved)) {
            return buildFilenameErrorMessage(filename, this.get_allowed_extensions());
        }
        filename = resolved;
        if (!oldStr) {
            return 'Error: Cannot replace empty string. Please provide a non-empty string to replace.';
        }
        const file = this.get_file(filename);
        if (!file) {
            if (wasSanitized) {
                return (`File '${filename}' not found. ` +
                    `(Filename was auto-corrected from '${originalFilename}')`);
            }
            return `File '${filename}' not found.`;
        }
        try {
            const content = file.read().replaceAll(oldStr, newStr);
            await file.write(content, this.dataDir);
            const sanitizeNote = wasSanitized
                ? ` (auto-corrected from '${originalFilename}')`
                : '';
            return (`Successfully replaced all occurrences of "${oldStr}" with "${newStr}" in file ${filename}` +
                sanitizeNote);
        }
        catch (error) {
            return `Error: Could not replace string in file '${filename}'. ${error.message}`;
        }
    }
    async save_extracted_content(content) {
        const filename = `extracted_content_${this.extractedContentCount}.md`;
        const file = new MarkdownFile(`extracted_content_${this.extractedContentCount}`);
        await file.write(content, this.dataDir);
        this.files.set(filename, file);
        this.extractedContentCount += 1;
        return filename;
    }
    describe() {
        const DISPLAY_CHARS = 400;
        let description = '';
        for (const file of this.files.values()) {
            if (file.fullName === 'todo.md') {
                continue;
            }
            const content = file.read();
            if (!content) {
                description += `<file>\n${file.fullName} - [empty file]\n</file>\n`;
                continue;
            }
            const lines = content.split(/\r?\n/);
            const lineCount = lines.length;
            if (content.length < DISPLAY_CHARS * 1.5) {
                description += `<file>\n${file.fullName} - ${lineCount} lines\n<content>\n${content}\n</content>\n</file>\n`;
                continue;
            }
            const halfChars = Math.floor(DISPLAY_CHARS / 2);
            let startPreview = '';
            let startLines = 0;
            let accumulated = 0;
            for (const line of lines) {
                if (accumulated + line.length + 1 > halfChars) {
                    break;
                }
                startPreview += `${line}\n`;
                accumulated += line.length + 1;
                startLines += 1;
            }
            let endPreview = '';
            let endLines = 0;
            accumulated = 0;
            for (let i = lines.length - 1; i >= 0; i -= 1) {
                const line = lines[i];
                if (accumulated + line.length + 1 > halfChars) {
                    break;
                }
                endPreview = `${line}\n${endPreview}`;
                accumulated += line.length + 1;
                endLines += 1;
            }
            const middleLines = lineCount - startLines - endLines;
            if (middleLines <= 0) {
                description += `<file>\n${file.fullName} - ${lineCount} lines\n<content>\n${content}\n</content>\n</file>\n`;
                continue;
            }
            description += `<file>\n${file.fullName} - ${lineCount} lines\n<content>\n${startPreview.trim()}\n`;
            description += `... ${middleLines} more lines ...\n`;
            description += `${endPreview.trim()}\n</content>\n</file>\n`;
        }
        return description.trim();
    }
    get_todo_contents() {
        const todo = this.get_file('todo.md');
        return todo?.read() ?? '';
    }
    get_state() {
        const files = {};
        for (const [filename, file] of this.files.entries()) {
            files[filename] = { type: file.constructor.name, data: file.toJSON() };
        }
        return {
            files,
            base_dir: this.baseDir,
            extracted_content_count: this.extractedContentCount,
        };
    }
    async nuke() {
        await fsp.rm(this.dataDir, { recursive: true, force: true });
    }
    static from_state_sync(state) {
        const fsInstance = new FileSystem(state.base_dir, false);
        fsInstance.extractedContentCount = state.extracted_content_count;
        for (const [filename, fileState] of Object.entries(state.files)) {
            const FileCtor = TYPE_NAME_MAP[fileState.type];
            if (!FileCtor) {
                continue;
            }
            const file = new FileCtor(fileState.data.name, fileState.data.content);
            fsInstance.files.set(filename, file);
            try {
                file.writeSync(fileState.data.content, fsInstance.dataDir);
            }
            catch (error) {
                throw new FileSystemError(`Error restoring file '${filename}': ${error.message}`);
            }
        }
        return fsInstance;
    }
    static async from_state(state) {
        return FileSystem.from_state_sync(state);
    }
}
