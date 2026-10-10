import { XMLParser } from 'fast-xml-parser';
import zlib from 'node:zlib';
import tar from 'tar-stream';
import AdmZip from 'adm-zip';
import path from 'node:path';
import { QuestionType } from '@prisma/client';

export type ImageHandler = (
  imageBuffer: Buffer,
  contentType: string,
  originalFilename: string
) => Promise<string>;

export interface ParsedMoodleOption {
  id: string;
  text: string;
  isCorrect: boolean;
  fraction?: number;
}

export interface ParsedMoodleQuestion {
  id?: string;
  name?: string;
  type: QuestionType;
  text: string;
  points: number;
  categoryName?: string;
  options?: ParsedMoodleOption[];
}

export interface ParsedMoodleResource {
  id: string;
  sectionId: string;
  title: string;
  intro: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  contentHash: string;
}

export interface ParsedMoodlePage {
  id: string;
  sectionId: string;
  title: string;
  intro: string;
  content: string;
}

export interface ParsedMoodleUrl {
  id: string;
  sectionId: string;
  title: string;
  externalUrl: string;
  intro: string;
}

export interface ParsedMoodleAssignment {
  id: string;
  sectionId: string;
  title: string;
  intro: string;
  deadline?: Date | null;
  maxScore: number;
  attachmentFile?: {
    fileName: string;
    fileSize: number;
    contentHash: string;
  };
}

export interface ParsedMoodleQuiz {
  id: string;
  sectionId: string;
  title: string;
  intro: string;
  durationMinutes?: number | null;
  deadline?: Date | null;
  passingGrade?: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questions: ParsedMoodleQuestion[];
}

export interface ParsedMoodleSection {
  id: string;
  number: number;
  title: string;
  summary: string;
  sequenceIds: string[];
}

export interface MoodleCourseParsedData {
  courseInfo: {
    fullname: string;
    shortname: string;
    summary: string;
  };
  sections: ParsedMoodleSection[];
  pages: ParsedMoodlePage[];
  resources: ParsedMoodleResource[];
  urls: ParsedMoodleUrl[];
  assignments: ParsedMoodleAssignment[];
  quizzes: ParsedMoodleQuiz[];
  questionBank: ParsedMoodleQuestion[];
  filesMap: Map<string, { fileName: string; mimeType: string; fileSize: number; buffer?: Buffer }>;
}

export interface MoodleImportPreviewItem {
  id: string;
  type: 'PAGE' | 'RESOURCE' | 'URL' | 'ASSIGN' | 'QUIZ';
  title: string;
  summary?: string;
  questionCount?: number;
  fileName?: string;
  fileSize?: number;
}

export interface MoodleImportPreviewModule {
  id: string;
  sectionNumber: number;
  title: string;
  summary: string;
  items: MoodleImportPreviewItem[];
}

export interface MoodleImportPreview {
  courseInfo: {
    fullname: string;
    shortname: string;
    summary: string;
  };
  modules: MoodleImportPreviewModule[];
  stats: {
    totalModules: number;
    totalPages: number;
    totalResources: number;
    totalUrls: number;
    totalAssignments: number;
    totalQuizzes: number;
    totalQuestions: number;
    totalBankQuestions: number;
  };
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '__cdata',
  trimValues: true,
  parseTagValue: false,
});

function extractTextValue(node: any): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number') return String(node);
  if (typeof node === 'object') {
    if (node.__cdata !== undefined) return String(node.__cdata).trim();
    if (node['#text'] !== undefined) return String(node['#text']).trim();
    if (node.text !== undefined) return extractTextValue(node.text);
  }
  return '';
}

function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').trim();
}

function determineContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    case '.pdf': return 'application/pdf';
    default: return 'application/octet-stream';
  }
}

// Standalone Moodle XML Question Parser
export async function parseMoodleXmlQuestions(
  xmlContent: string,
  imageHandler?: ImageHandler
): Promise<{ questions: ParsedMoodleQuestion[]; warnings: string[] }> {
  const parsed = xmlParser.parse(xmlContent);
  const quizNode = parsed?.quiz;

  if (!quizNode) {
    throw new Error('Format file tidak valid: Elemen root <quiz> tidak ditemukan.');
  }

  const rawQuestions = Array.isArray(quizNode.question)
    ? quizNode.question
    : quizNode.question
    ? [quizNode.question]
    : [];

  const questions: ParsedMoodleQuestion[] = [];
  const warnings: string[] = [];
  let currentCategory = 'Umum';

  for (let index = 0; index < rawQuestions.length; index++) {
    const qNode = rawQuestions[index];
    const qType = qNode['@_type'] || qNode.qtype;

    // Track question category tag: <question type="category">
    if (qType === 'category') {
      const catText = extractTextValue(qNode.category);
      if (catText) {
        // Moodle category format: $course$/top/Nama Kategori
        const parts = catText.split('/').map((s) => s.trim()).filter(Boolean);
        currentCategory = parts.length > 0 ? parts[parts.length - 1] : catText;
        if (currentCategory.startsWith('$')) {
          currentCategory = parts.length > 1 ? parts[parts.length - 1] : 'Umum';
        }
      }
      continue;
    }

    const qName = extractTextValue(qNode.name);
    let qText = extractTextValue(qNode.questiontext);
    const defaultGrade = parseFloat(extractTextValue(qNode.defaultgrade) || extractTextValue(qNode.defaultmark) || '1');
    const points = isNaN(defaultGrade) || defaultGrade <= 0 ? 1 : defaultGrade;

    // Process embedded base64 images inside question text
    if (qNode.questiontext?.file) {
      const files = Array.isArray(qNode.questiontext.file)
        ? qNode.questiontext.file
        : [qNode.questiontext.file];

      for (const f of files) {
        const fname = f['@_name'] || extractTextValue(f.name);
        const encoding = f['@_encoding'] || 'base64';
        const fileContent = extractTextValue(f);

        if (fname && fileContent && encoding === 'base64') {
          const imgBuffer = Buffer.from(fileContent, 'base64');
          const mimeType = determineContentType(fname);
          let targetUrl = `data:${mimeType};base64,${fileContent}`;

          if (imageHandler) {
            try {
              targetUrl = await imageHandler(imgBuffer, mimeType, fname);
            } catch (err) {
              console.warn(`Gagal memproses gambar ${fname}:`, err);
            }
          }

          const regex = new RegExp(`@@PLUGINFILE@@\\/${escapeRegExp(fname)}`, 'g');
          qText = qText.replace(regex, targetUrl);
        }
      }
    }

    if (qType === 'multichoice') {
      const isSingle = qNode.single === 'true' || qNode.single === true || qNode.single === '1' || qNode.single === 1;
      const rawAnswers = Array.isArray(qNode.answer)
        ? qNode.answer
        : qNode.answer
        ? [qNode.answer]
        : [];

      const options: ParsedMoodleOption[] = [];
      let positiveCount = 0;

      for (let i = 0; i < rawAnswers.length; i++) {
        const ansNode = rawAnswers[i];
        let optText = extractTextValue(ansNode);
        const fraction = parseFloat(ansNode['@_fraction'] || '0');
        const isCorrect = fraction > 0;
        if (isCorrect) positiveCount++;

        // Process answer embedded images if any
        if (ansNode.file) {
          const optFiles = Array.isArray(ansNode.file) ? ansNode.file : [ansNode.file];
          for (const ofile of optFiles) {
            const ofName = ofile['@_name'] || extractTextValue(ofile.name);
            const ofContent = extractTextValue(ofile);
            if (ofName && ofContent) {
              const imgBuf = Buffer.from(ofContent, 'base64');
              const mime = determineContentType(ofName);
              let optImgUrl = `data:${mime};base64,${ofContent}`;
              if (imageHandler) {
                try {
                  optImgUrl = await imageHandler(imgBuf, mime, ofName);
                } catch {
                  // Fallback to data URI
                }
              }
              const reg = new RegExp(`@@PLUGINFILE@@\\/${escapeRegExp(ofName)}`, 'g');
              optText = optText.replace(reg, optImgUrl);
            }
          }
        }

        const label = String.fromCharCode(65 + i);
        options.push({
          id: label,
          text: stripHtmlTags(optText) || optText,
          isCorrect,
          fraction,
        });
      }

      const finalType: QuestionType = !isSingle && positiveCount > 1
        ? 'MULTIPLE_CHOICE_COMPLEX'
        : 'MULTIPLE_CHOICE';

      questions.push({
        id: `moodle_q_${index}`,
        name: qName,
        type: finalType,
        text: qText || qName,
        points,
        categoryName: currentCategory,
        options,
      });
    } else if (qType === 'truefalse') {
      const rawAnswers = Array.isArray(qNode.answer)
        ? qNode.answer
        : qNode.answer
        ? [qNode.answer]
        : [];

      let trueFraction = 0;
      for (const ans of rawAnswers) {
        const ansVal = extractTextValue(ans).toLowerCase();
        const fraction = parseFloat(ans['@_fraction'] || '0');
        if (ansVal === 'true' || ansVal === 'benar' || ansVal === '1') {
          trueFraction = fraction;
        }
      }

      const isTrueCorrect = trueFraction > 50;
      questions.push({
        id: `moodle_q_${index}`,
        name: qName,
        type: 'MULTIPLE_CHOICE',
        text: qText || qName,
        points,
        categoryName: currentCategory,
        options: [
          { id: 'A', text: 'Benar (True)', isCorrect: isTrueCorrect },
          { id: 'B', text: 'Salah (False)', isCorrect: !isTrueCorrect },
        ],
      });
    } else if (qType === 'essay' || qType === 'shortanswer') {
      questions.push({
        id: `moodle_q_${index}`,
        name: qName,
        type: 'ESSAY',
        text: qText || qName,
        points,
        categoryName: currentCategory,
      });
    } else {
      // Convert unsupported question types to Essay to preserve content
      warnings.push(`Tipe soal '${qType}' pada '${qName || `Soal #${index + 1}`}' dikonversi ke format Esai.`);
      questions.push({
        id: `moodle_q_${index}`,
        name: qName,
        type: 'ESSAY',
        text: qText || qName,
        points,
        categoryName: currentCategory,
      });
    }
  }

  return { questions, warnings };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Extract files from tar.gz or zip buffer
export async function unpackArchiveToMemory(
  archiveBuffer: Buffer
): Promise<Map<string, Buffer>> {
  const maxExpanded = Number(process.env.MOODLE_MAX_EXPANDED_MB ?? 256) * 1024 * 1024;
  if (!Number.isSafeInteger(maxExpanded) || maxExpanded < 1024 * 1024 || maxExpanded > 1024 * 1024 * 1024) throw new Error('Batas ekstraksi tidak valid');
  const maxEntries = 10000;
  const startedAt = Date.now();
  const ensureTime = () => { if (Date.now() - startedAt > 30000) throw new Error('Batas waktu ekstraksi terlampaui'); };
  const fileMap = new Map<string, Buffer>();

  // Detect GZIP signature: 0x1F, 0x8B
  const isGzip = archiveBuffer.length >= 2 && archiveBuffer[0] === 0x1f && archiveBuffer[1] === 0x8b;
  // Detect PKZip signature: 'PK\x03\x04'
  const isZip = archiveBuffer.length >= 4 &&
    archiveBuffer[0] === 0x50 &&
    archiveBuffer[1] === 0x4b &&
    archiveBuffer[2] === 0x03 &&
    archiveBuffer[3] === 0x04;

  if (isGzip) {
    const decompressed = await new Promise<Buffer>((resolve, reject) => {
      zlib.gunzip(archiveBuffer, { maxOutputLength: Math.min(maxExpanded, Math.max(archiveBuffer.length * 100, 1024 * 1024)) }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    await new Promise<void>((resolve, reject) => {
      const extract = tar.extract();
      let entryCount = 0;
      extract.on('entry', (header, stream, next) => {
        if (++entryCount > maxEntries || Date.now() - startedAt > 30000) {
          stream.resume();
          extract.destroy(new Error('Batas ekstraksi arsip terlampaui'));
          return;
        }
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: any) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        stream.on('end', () => {
          if (header.type === 'file') {
            const normalizedName = header.name.replace(/\\/g, '/').replace(/^\.\//, '');
            fileMap.set(normalizedName, Buffer.concat(chunks));
          }
          next();
        });
        stream.resume();
      });
      extract.on('finish', () => resolve());
      extract.on('error', (err) => reject(err));
      extract.end(decompressed);
    });
  } else if (isZip) {
    const zip = new AdmZip(archiveBuffer);
    const zipEntries = zip.getEntries();
    if (zipEntries.length > maxEntries) throw new Error('Terlalu banyak file dalam arsip');
    let expanded = 0;
    for (const entry of zipEntries) {
      ensureTime();
      if (!entry.isDirectory) {
        const normalizedName = entry.entryName.replace(/\\/g, '/').replace(/^\.\//, '');
        const budget = Math.min(maxExpanded - expanded, Math.max(archiveBuffer.length * 100, 1024 * 1024));
        if (entry.header.size > budget || budget <= 0 || (entry.header.flags & 1)) throw new Error('Batas ukuran ekstraksi terlampaui atau arsip terenkripsi');
        const compressed = entry.getCompressedData();
        let data: Buffer;
        if (entry.header.method === 0) {
          if (compressed.length > budget) throw new Error('Batas ukuran ekstraksi terlampaui');
          data = compressed;
        } else if (entry.header.method === 8) {
          data = await new Promise<Buffer>((resolve, reject) => zlib.inflateRaw(compressed, { maxOutputLength: budget }, (error, result) => error ? reject(error) : resolve(result)));
        } else throw new Error('Metode kompresi tidak didukung');
        if (data.length !== entry.header.size) throw new Error('Ukuran entry arsip tidak valid');
        expanded += data.length;
        fileMap.set(normalizedName, data);
      }
    }
  } else {
    throw new Error('Format arsip tidak didukung. File harus berupa arsip backup Moodle (.mbz, .tar.gz, atau .zip).');
  }

  return fileMap;
}

// Parse entire Moodle course backup archive (.mbz)
export async function parseMoodleBackup(
  archiveBuffer: Buffer,
  imageHandler?: ImageHandler
): Promise<MoodleCourseParsedData> {
  const filesMap = await unpackArchiveToMemory(archiveBuffer);

  // 1. Parse moodle_backup.xml
  const backupXmlBuffer = filesMap.get('moodle_backup.xml');
  if (!backupXmlBuffer) {
    throw new Error('Arsip tidak valid: File moodle_backup.xml tidak ditemukan di dalam paket.');
  }

  const backupDoc = xmlParser.parse(backupXmlBuffer.toString('utf-8'));
  const backupInfo = backupDoc?.moodle_backup?.information;
  if (!backupInfo) {
    throw new Error('Struktur moodle_backup.xml tidak sesuai standar Moodle.');
  }

  const courseInfo = {
    fullname: extractTextValue(backupInfo.original_course_fullname) || 'Kursus Moodle',
    shortname: extractTextValue(backupInfo.original_course_shortname) || '',
    summary: extractTextValue(backupInfo.original_course_summary) || '',
  };

  // 2. Parse files.xml for content hashing and attachments
  interface MoodleFileMeta {
    contentHash: string;
    contextId: string;
    component: string;
    fileArea: string;
    itemId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }
  const fileRegistry: MoodleFileMeta[] = [];
  const filesXmlBuffer = filesMap.get('files.xml');
  if (filesXmlBuffer) {
    const filesDoc = xmlParser.parse(filesXmlBuffer.toString('utf-8'));
    const rawFiles = Array.isArray(filesDoc?.files?.file)
      ? filesDoc.files.file
      : filesDoc?.files?.file
      ? [filesDoc.files.file]
      : [];

    for (const f of rawFiles) {
      const fileName = extractTextValue(f.filename);
      // Moodle denotes directory nodes with filename '.'
      if (!fileName || fileName === '.') continue;

      fileRegistry.push({
        contentHash: extractTextValue(f.contenthash),
        contextId: extractTextValue(f.contextid),
        component: extractTextValue(f.component),
        fileArea: extractTextValue(f.filearea),
        itemId: extractTextValue(f.itemid),
        fileName,
        fileSize: parseInt(extractTextValue(f.filesize) || '0', 10),
        mimeType: extractTextValue(f.mimetype) || determineContentType(fileName),
      });
    }
  }

  function getFileBufferByHash(hash: string): Buffer | undefined {
    if (!hash) return undefined;
    const pathWithPrefix = `files/${hash.substring(0, 2)}/${hash}`;
    const directPath = `files/${hash}`;
    return filesMap.get(pathWithPrefix) || filesMap.get(directPath);
  }

  // 3. Parse questions.xml (Question bank at root)
  const questionBank: ParsedMoodleQuestion[] = [];
  const questionsById = new Map<string, ParsedMoodleQuestion>();
  const questionsXmlBuffer = filesMap.get('questions.xml');

  if (questionsXmlBuffer) {
    const questionsDoc = xmlParser.parse(questionsXmlBuffer.toString('utf-8'));
    const rawCategories = Array.isArray(questionsDoc?.question_categories?.question_category)
      ? questionsDoc.question_categories.question_category
      : questionsDoc?.question_categories?.question_category
      ? [questionsDoc.question_categories.question_category]
      : [];

    for (const cat of rawCategories) {
      const catName = extractTextValue(cat.name) || 'Umum';
      const rawQuestions = Array.isArray(cat?.questions?.question)
        ? cat.questions.question
        : cat?.questions?.question
        ? [cat.questions.question]
        : [];

      for (const qNode of rawQuestions) {
        const qId = extractTextValue(qNode.id) || qNode['@_id'];
        const qType = extractTextValue(qNode.qtype);
        const qName = extractTextValue(qNode.name);
        const qText = extractTextValue(qNode.questiontext);
        const defaultMark = parseFloat(extractTextValue(qNode.defaultmark) || '1');
        const points = isNaN(defaultMark) || defaultMark <= 0 ? 1 : defaultMark;

        if (qType === 'multichoice') {
          const multiPlugin = qNode.plugin_qtype_multichoice_question;
          const isSingle = multiPlugin?.multichoice?.single === '1' || multiPlugin?.multichoice?.single === 1;
          const answers = Array.isArray(multiPlugin?.answers?.answer)
            ? multiPlugin.answers.answer
            : multiPlugin?.answers?.answer
            ? [multiPlugin.answers.answer]
            : [];

          const options: ParsedMoodleOption[] = answers.map((ans: any, idx: number) => {
            const optText = extractTextValue(ans.answertext);
            const fraction = parseFloat(extractTextValue(ans.fraction) || '0');
            return {
              id: String.fromCharCode(65 + idx),
              text: stripHtmlTags(optText) || optText,
              isCorrect: fraction > 0,
              fraction,
            };
          });

          const posCount = options.filter((o) => o.isCorrect).length;
          const finalType: QuestionType = !isSingle && posCount > 1
            ? 'MULTIPLE_CHOICE_COMPLEX'
            : 'MULTIPLE_CHOICE';

          const parsedQ: ParsedMoodleQuestion = {
            id: qId,
            name: qName,
            type: finalType,
            text: qText || qName,
            points,
            categoryName: catName,
            options,
          };
          questionBank.push(parsedQ);
          if (qId) questionsById.set(qId, parsedQ);
        } else if (qType === 'truefalse') {
          const tfPlugin = qNode.plugin_qtype_truefalse_question;
          const trueAnsId = extractTextValue(tfPlugin?.truefalse?.trueanswer);
          const rawAnswers = Array.isArray(tfPlugin?.answers?.answer)
            ? tfPlugin.answers.answer
            : tfPlugin?.answers?.answer
            ? [tfPlugin.answers.answer]
            : [];

          let isTrueCorrect = false;
          for (const ans of rawAnswers) {
            const ansId = extractTextValue(ans.id);
            const fraction = parseFloat(extractTextValue(ans.fraction) || '0');
            if (ansId === trueAnsId && fraction > 0) {
              isTrueCorrect = true;
            }
          }

          const parsedQ: ParsedMoodleQuestion = {
            id: qId,
            name: qName,
            type: 'MULTIPLE_CHOICE',
            text: qText || qName,
            points,
            categoryName: catName,
            options: [
              { id: 'A', text: 'Benar (True)', isCorrect: isTrueCorrect },
              { id: 'B', text: 'Salah (False)', isCorrect: !isTrueCorrect },
            ],
          };
          questionBank.push(parsedQ);
          if (qId) questionsById.set(qId, parsedQ);
        } else if (qType === 'essay' || qType === 'shortanswer') {
          const parsedQ: ParsedMoodleQuestion = {
            id: qId,
            name: qName,
            type: 'ESSAY',
            text: qText || qName,
            points,
            categoryName: catName,
          };
          questionBank.push(parsedQ);
          if (qId) questionsById.set(qId, parsedQ);
        } else {
          // Convert other types to Essay
          const parsedQ: ParsedMoodleQuestion = {
            id: qId,
            name: qName,
            type: 'ESSAY',
            text: qText || qName,
            points,
            categoryName: catName,
          };
          questionBank.push(parsedQ);
          if (qId) questionsById.set(qId, parsedQ);
        }
      }
    }
  }

  // 4. Parse Sections
  const sections: ParsedMoodleSection[] = [];
  const rawSections = Array.isArray(backupInfo.contents?.sections?.section)
    ? backupInfo.contents.sections.section
    : backupInfo.contents?.sections?.section
    ? [backupInfo.contents.sections.section]
    : [];

  for (const sNode of rawSections) {
    const sId = extractTextValue(sNode.sectionid);
    const sDir = extractTextValue(sNode.directory);
    const sectionXmlBuf = filesMap.get(`${sDir}/section.xml`);

    let sTitle = extractTextValue(sNode.title);
    let sNumber = parseInt(extractTextValue(sNode.sectionid) || '0', 10);
    let sSummary = '';
    let sequenceIds: string[] = [];

    if (sectionXmlBuf) {
      const sDoc = xmlParser.parse(sectionXmlBuf.toString('utf-8'));
      const secNode = sDoc?.section;
      if (secNode) {
        sNumber = parseInt(extractTextValue(secNode.number) || String(sNumber), 10);
        const xmlName = extractTextValue(secNode.name);
        if (xmlName) sTitle = xmlName;
        sSummary = extractTextValue(secNode.summary);
        const seqStr = extractTextValue(secNode.sequence);
        if (seqStr) {
          sequenceIds = seqStr.split(',').map((x) => x.trim()).filter(Boolean);
        }
      }
    }

    if (!sTitle) {
      sTitle = sNumber === 0 ? 'Informasi & Pembuka' : `Modul ${sNumber}`;
    }

    sections.push({
      id: sId,
      number: sNumber,
      title: sTitle,
      summary: sSummary,
      sequenceIds,
    });
  }

  sections.sort((a, b) => a.number - b.number);

  // 5. Parse Activities (Page, Resource, URL, Assign, Quiz)
  const pages: ParsedMoodlePage[] = [];
  const resources: ParsedMoodleResource[] = [];
  const urls: ParsedMoodleUrl[] = [];
  const assignments: ParsedMoodleAssignment[] = [];
  const quizzes: ParsedMoodleQuiz[] = [];

  const rawActivities = Array.isArray(backupInfo.contents?.activities?.activity)
    ? backupInfo.contents.activities.activity
    : backupInfo.contents?.activities?.activity
    ? [backupInfo.contents.activities.activity]
    : [];

  for (const act of rawActivities) {
    const modId = extractTextValue(act.moduleid);
    const secId = extractTextValue(act.sectionid);
    const modName = extractTextValue(act.modulename);
    const actDir = extractTextValue(act.directory);
    const actTitle = extractTextValue(act.title);

    if (modName === 'page') {
      const pageBuf = filesMap.get(`${actDir}/page.xml`);
      if (pageBuf) {
        const pDoc = xmlParser.parse(pageBuf.toString('utf-8'));
        const pNode = pDoc?.activity?.page;
        if (pNode) {
          const content = extractTextValue(pNode.content);
          const intro = extractTextValue(pNode.intro);
          pages.push({
            id: modId,
            sectionId: secId,
            title: extractTextValue(pNode.name) || actTitle,
            intro,
            content,
          });
        }
      }
    } else if (modName === 'resource') {
      const resBuf = filesMap.get(`${actDir}/resource.xml`);
      if (resBuf) {
        const rDoc = xmlParser.parse(resBuf.toString('utf-8'));
        const rNode = rDoc?.activity?.resource;
        const resTitle = extractTextValue(rNode?.name) || actTitle;
        const resIntro = extractTextValue(rNode?.intro);

        // Find file attachment in fileRegistry by directory context
        const actContextId = extractTextValue(rDoc?.activity?.['@_contextid']);
        const attached = fileRegistry.find(
          (f) => f.component === 'mod_resource' && f.fileArea === 'content' && (!actContextId || f.contextId === actContextId)
        ) || fileRegistry.find((f) => f.component === 'mod_resource');

        if (attached) {
          resources.push({
            id: modId,
            sectionId: secId,
            title: resTitle,
            intro: resIntro,
            fileName: attached.fileName,
            fileSize: attached.fileSize,
            mimeType: attached.mimeType,
            contentHash: attached.contentHash,
          });
        }
      }
    } else if (modName === 'url') {
      const urlBuf = filesMap.get(`${actDir}/url.xml`);
      if (urlBuf) {
        const uDoc = xmlParser.parse(urlBuf.toString('utf-8'));
        const uNode = uDoc?.activity?.url;
        urls.push({
          id: modId,
          sectionId: secId,
          title: extractTextValue(uNode?.name) || actTitle,
          externalUrl: extractTextValue(uNode?.externalurl),
          intro: extractTextValue(uNode?.intro),
        });
      }
    } else if (modName === 'assign') {
      const assignBuf = filesMap.get(`${actDir}/assign.xml`);
      if (assignBuf) {
        const aDoc = xmlParser.parse(assignBuf.toString('utf-8'));
        const aNode = aDoc?.activity?.assign;
        const duedateSec = parseInt(extractTextValue(aNode?.duedate) || '0', 10);
        const gradeMax = parseFloat(extractTextValue(aNode?.grade) || '100');

        const actContextId = extractTextValue(aDoc?.activity?.['@_contextid']);
        const attached = fileRegistry.find(
          (f) => f.component === 'mod_assign' && f.fileArea === 'introattachment' && (!actContextId || f.contextId === actContextId)
        );

        assignments.push({
          id: modId,
          sectionId: secId,
          title: extractTextValue(aNode?.name) || actTitle,
          intro: extractTextValue(aNode?.intro),
          deadline: duedateSec > 0 ? new Date(duedateSec * 1000) : null,
          maxScore: isNaN(gradeMax) || gradeMax <= 0 ? 100 : gradeMax,
          attachmentFile: attached
            ? {
                fileName: attached.fileName,
                fileSize: attached.fileSize,
                contentHash: attached.contentHash,
              }
            : undefined,
        });
      }
    } else if (modName === 'quiz') {
      const quizBuf = filesMap.get(`${actDir}/quiz.xml`);
      if (quizBuf) {
        const qDoc = xmlParser.parse(quizBuf.toString('utf-8'));
        const qNode = qDoc?.activity?.quiz;
        const timelimitSec = parseInt(extractTextValue(qNode?.timelimit) || '0', 10);
        const timecloseSec = parseInt(extractTextValue(qNode?.timeclose) || '0', 10);
        const gradepass = parseFloat(extractTextValue(qNode?.gradepass) || '0');
        const shuffleQ = qNode?.shuffleanswers === '1' || qNode?.shuffleanswers === 1;

        // Collect question instances
        const rawInstances = Array.isArray(qNode?.question_instances?.question_instance)
          ? qNode.question_instances.question_instance
          : qNode?.question_instances?.question_instance
          ? [qNode.question_instances.question_instance]
          : [];

        const quizQuestions: ParsedMoodleQuestion[] = [];
        for (const inst of rawInstances) {
          const qId = extractTextValue(inst.questionid);
          const found = questionsById.get(qId);
          if (found) {
            quizQuestions.push(found);
          }
        }

        quizzes.push({
          id: modId,
          sectionId: secId,
          title: extractTextValue(qNode?.name) || actTitle,
          intro: extractTextValue(qNode?.intro),
          durationMinutes: timelimitSec > 0 ? Math.ceil(timelimitSec / 60) : null,
          deadline: timecloseSec > 0 ? new Date(timecloseSec * 1000) : null,
          passingGrade: gradepass > 0 ? gradepass : null,
          shuffleQuestions: shuffleQ,
          shuffleOptions: true,
          questions: quizQuestions,
        });
      }
    }
  }

  // Build resolved files map
  const resolvedFilesMap = new Map<string, { fileName: string; mimeType: string; fileSize: number; buffer?: Buffer }>();
  for (const meta of fileRegistry) {
    const buf = getFileBufferByHash(meta.contentHash);
    resolvedFilesMap.set(meta.contentHash, {
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      fileSize: meta.fileSize,
      buffer: buf,
    });
  }

  return {
    courseInfo,
    sections,
    pages,
    resources,
    urls,
    assignments,
    quizzes,
    questionBank,
    filesMap: resolvedFilesMap,
  };
}

// Generate user-friendly preview summary for UI selection
export function buildMoodlePreview(parsedData: MoodleCourseParsedData): MoodleImportPreview {
  const { sections, pages, resources, urls, assignments, quizzes, questionBank } = parsedData;

  const modules: MoodleImportPreviewModule[] = [];
  let totalQuestionsInQuizzes = 0;

  for (const sec of sections) {
    const items: MoodleImportPreviewItem[] = [];

    // Pages (Materi Teks)
    for (const p of pages.filter((x) => x.sectionId === sec.id)) {
      items.push({
        id: `page_${p.id}`,
        type: 'PAGE',
        title: p.title,
        summary: p.intro ? stripHtmlTags(p.intro).slice(0, 100) : undefined,
      });
    }

    // Resources (Berkas Materi)
    for (const r of resources.filter((x) => x.sectionId === sec.id)) {
      items.push({
        id: `resource_${r.id}`,
        type: 'RESOURCE',
        title: r.title,
        fileName: r.fileName,
        fileSize: r.fileSize,
      });
    }

    // URLs (Tautan / Video)
    for (const u of urls.filter((x) => x.sectionId === sec.id)) {
      items.push({
        id: `url_${u.id}`,
        type: 'URL',
        title: u.title,
        summary: u.externalUrl,
      });
    }

    // Assignments (Penugasan)
    for (const a of assignments.filter((x) => x.sectionId === sec.id)) {
      items.push({
        id: `assign_${a.id}`,
        type: 'ASSIGN',
        title: a.title,
        summary: a.intro ? stripHtmlTags(a.intro).slice(0, 100) : undefined,
        fileName: a.attachmentFile?.fileName,
      });
    }

    // Quizzes (Kuis)
    for (const q of quizzes.filter((x) => x.sectionId === sec.id)) {
      totalQuestionsInQuizzes += q.questions.length;
      items.push({
        id: `quiz_${q.id}`,
        type: 'QUIZ',
        title: q.title,
        questionCount: q.questions.length,
      });
    }

    // Include section even if empty, but keep order
    modules.push({
      id: sec.id,
      sectionNumber: sec.number,
      title: sec.title,
      summary: sec.summary ? stripHtmlTags(sec.summary).slice(0, 100) : '',
      items,
    });
  }

  return {
    courseInfo: parsedData.courseInfo,
    modules,
    stats: {
      totalModules: sections.length,
      totalPages: pages.length,
      totalResources: resources.length,
      totalUrls: urls.length,
      totalAssignments: assignments.length,
      totalQuizzes: quizzes.length,
      totalQuestions: totalQuestionsInQuizzes,
      totalBankQuestions: questionBank.length,
    },
  };
}
