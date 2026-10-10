import { describe, it, expect } from 'vitest';
import { parseMoodleXmlQuestions } from '@/lib/utils/moodle-parser';

describe('Moodle Parser - Moodle XML Questions', () => {
  it('parses single choice multiple choice questions with fraction percentages', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="category">
    <category><text>$course$/Bab 1 Aljabar</text></category>
  </question>
  <question type="multichoice">
    <name><text>Soal 1</text></name>
    <questiontext format="html">
      <text><![CDATA[<p>Berapakah nilai 2 + 2?</p>]]></text>
    </questiontext>
    <defaultgrade>2.5</defaultgrade>
    <single>true</single>
    <shuffleanswers>true</shuffleanswers>
    <answer fraction="100" format="html">
      <text><![CDATA[<p>4</p>]]></text>
    </answer>
    <answer fraction="0" format="html">
      <text><![CDATA[<p>3</p>]]></text>
    </answer>
    <answer fraction="0" format="html">
      <text><![CDATA[<p>5</p>]]></text>
    </answer>
  </question>
</quiz>`;

    const result = await parseMoodleXmlQuestions(xml);
    expect(result.questions).toHaveLength(1);
    const q = result.questions[0];
    expect(q.type).toBe('MULTIPLE_CHOICE');
    expect(q.text).toContain('Berapakah nilai 2 + 2?');
    expect(q.points).toBe(2.5);
    expect(q.categoryName).toBe('Bab 1 Aljabar');
    expect(q.options).toBeDefined();
    expect(q.options).toHaveLength(3);
    expect(q.options![0].isCorrect).toBe(true);
    expect(q.options![0].text).toBe('4');
    expect(q.options![1].isCorrect).toBe(false);
  });

  it('parses complex multiple choice (multiple correct answers)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="multichoice">
    <name><text>Soal Pilihan Ganda Kompleks</text></name>
    <questiontext format="html">
      <text><![CDATA[<p>Pilih bilangan prima berikut:</p>]]></text>
    </questiontext>
    <defaultgrade>5</defaultgrade>
    <single>false</single>
    <answer fraction="50" format="html">
      <text><![CDATA[<p>2</p>]]></text>
    </answer>
    <answer fraction="50" format="html">
      <text><![CDATA[<p>3</p>]]></text>
    </answer>
    <answer fraction="-50" format="html">
      <text><![CDATA[<p>4</p>]]></text>
    </answer>
  </question>
</quiz>`;

    const result = await parseMoodleXmlQuestions(xml);
    expect(result.questions).toHaveLength(1);
    const q = result.questions[0];
    expect(q.type).toBe('MULTIPLE_CHOICE_COMPLEX');
    expect(q.options).toBeDefined();
    expect(q.options).toHaveLength(3);
    expect(q.options![0].isCorrect).toBe(true);
    expect(q.options![1].isCorrect).toBe(true);
    expect(q.options![2].isCorrect).toBe(false);
  });

  it('converts true/false questions into standard multiple choice with two options', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="truefalse">
    <name><text>Soal Benar Salah</text></name>
    <questiontext format="html">
      <text><![CDATA[<p>Bumi mengelilingi matahari.</p>]]></text>
    </questiontext>
    <defaultgrade>1</defaultgrade>
    <answer fraction="100">
      <text>true</text>
    </answer>
    <answer fraction="0">
      <text>false</text>
    </answer>
  </question>
</quiz>`;

    const result = await parseMoodleXmlQuestions(xml);
    expect(result.questions).toHaveLength(1);
    const q = result.questions[0];
    expect(q.type).toBe('MULTIPLE_CHOICE');
    expect(q.options).toBeDefined();
    expect(q.options).toHaveLength(2);
    expect(q.options!.find((o) => o.text.toLowerCase().includes('benar'))?.isCorrect).toBe(true);
    expect(q.options!.find((o) => o.text.toLowerCase().includes('salah'))?.isCorrect).toBe(false);
  });

  it('parses essay questions correctly', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="essay">
    <name><text>Soal Esai</text></name>
    <questiontext format="html">
      <text><![CDATA[<p>Jelaskan proses terjadinya fotosintesis secara singkat.</p>]]></text>
    </questiontext>
    <defaultgrade>10</defaultgrade>
  </question>
</quiz>`;

    const result = await parseMoodleXmlQuestions(xml);
    expect(result.questions).toHaveLength(1);
    const q = result.questions[0];
    expect(q.type).toBe('ESSAY');
    expect(q.points).toBe(10);
    expect(q.options).toBeUndefined();
  });

  it('extracts embedded base64 images and rewrites image URLs', async () => {
    const fakeBase64 = Buffer.from('fake-image-content').toString('base64');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="multichoice">
    <name><text>Soal Bergambar</text></name>
    <questiontext format="html">
      <text><![CDATA[<p>Perhatikan gambar berikut: <img src="@@PLUGINFILE@@/diagram.png" alt="Diagram"></p>]]></text>
      <file name="diagram.png" path="/" encoding="base64">${fakeBase64}</file>
    </questiontext>
    <defaultgrade>1</defaultgrade>
    <single>true</single>
    <answer fraction="100">
      <text>A</text>
    </answer>
    <answer fraction="0">
      <text>B</text>
    </answer>
  </question>
</quiz>`;

    const mockImageHandler = async (_buffer: Buffer, _contentType: string, originalName: string) => {
      return `/api/files/saved_${originalName}`;
    };

    const result = await parseMoodleXmlQuestions(xml, mockImageHandler);
    expect(result.questions).toHaveLength(1);
    const q = result.questions[0];
    expect(q.text).toContain('/api/files/saved_diagram.png');
    expect(q.text).not.toContain('@@PLUGINFILE@@');
  });
});

describe('Moodle Parser - Course Backup Archive (.mbz)', () => {
  it('parses mock Moodle backup archive and generates course preview', async () => {
    const { parseMoodleBackup, buildMoodlePreview } = await import('@/lib/utils/moodle-parser');
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();

    // moodle_backup.xml
    const moodleBackupXml = `<?xml version="1.0" encoding="UTF-8"?>
<moodle_backup>
  <information>
    <name>backup-moodle-test.mbz</name>
    <original_course_fullname>Fisika Dasar Kelas X</original_course_fullname>
    <original_course_shortname>FIS-X</original_course_shortname>
    <original_course_summary>Pembahasan materi gerak lurus dan dinamika.</original_course_summary>
    <contents>
      <sections>
        <section>
          <sectionid>10</sectionid>
          <title>Bab 1: Kinematika Gerak</title>
          <directory>sections/section_10</directory>
        </section>
      </sections>
      <activities>
        <activity>
          <moduleid>101</moduleid>
          <sectionid>10</sectionid>
          <modulename>page</modulename>
          <title>Materi Pengantar Gerak</title>
          <directory>activities/page_101</directory>
        </activity>
        <activity>
          <moduleid>102</moduleid>
          <sectionid>10</sectionid>
          <modulename>assign</modulename>
          <title>Tugas Analisis Kecepatan</title>
          <directory>activities/assign_102</directory>
        </activity>
        <activity>
          <moduleid>103</moduleid>
          <sectionid>10</sectionid>
          <modulename>quiz</modulename>
          <title>Kuis Kinematika 1</title>
          <directory>activities/quiz_103</directory>
        </activity>
      </activities>
    </contents>
  </information>
</moodle_backup>`;

    // sections/section_10/section.xml
    const sectionXml = `<?xml version="1.0" encoding="UTF-8"?>
<section>
  <number>1</number>
  <name>Bab 1: Kinematika Gerak</name>
  <summary>Pembahasan kecepatan dan percepatan.</summary>
  <sequence>101,102,103</sequence>
</section>`;

    // activities/page_101/page.xml
    const pageXml = `<?xml version="1.0" encoding="UTF-8"?>
<activity id="1" moduleid="101" modulename="page">
  <page>
    <name>Materi Pengantar Gerak</name>
    <intro>Baca materi ini dengan seksama.</intro>
    <content>&lt;p&gt;Gerak lurus beraturan adalah gerak dengan kecepatan tetap.&lt;/p&gt;</content>
  </page>
</activity>`;

    // activities/assign_102/assign.xml
    const assignXml = `<?xml version="1.0" encoding="UTF-8"?>
<activity id="2" moduleid="102" modulename="assign">
  <assign>
    <name>Tugas Analisis Kecepatan</name>
    <intro>Kerjakan soal hitungan grafik GLB dan GLBB.</intro>
    <duedate>1735689600</duedate>
    <grade>100</grade>
  </assign>
</activity>`;

    // questions.xml
    const questionsXml = `<?xml version="1.0" encoding="UTF-8"?>
<question_categories>
  <question_category id="1">
    <name>Bank Soal Fisika</name>
    <questions>
      <question id="501">
        <name>Soal GLB</name>
        <questiontext>Sebuah mobil melaju 60 km/jam...</questiontext>
        <defaultmark>5</defaultmark>
        <qtype>multichoice</qtype>
        <plugin_qtype_multichoice_question>
          <multichoice>
            <single>1</single>
          </multichoice>
          <answers>
            <answer id="1">
              <answertext>120 km</answertext>
              <fraction>1.0</fraction>
            </answer>
            <answer id="2">
              <answertext>60 km</answertext>
              <fraction>0.0</fraction>
            </answer>
          </answers>
        </plugin_qtype_multichoice_question>
      </question>
    </questions>
  </question_category>
</question_categories>`;

    // activities/quiz_103/quiz.xml
    const quizXml = `<?xml version="1.0" encoding="UTF-8"?>
<activity id="3" moduleid="103" modulename="quiz">
  <quiz>
    <name>Kuis Kinematika 1</name>
    <intro>Kuis 5 butir soal.</intro>
    <timelimit>1800</timelimit>
    <gradepass>75</gradepass>
    <question_instances>
      <question_instance id="1">
        <questionid>501</questionid>
      </question_instance>
    </question_instances>
  </quiz>
</activity>`;

    zip.addFile('moodle_backup.xml', Buffer.from(moodleBackupXml));
    zip.addFile('sections/section_10/section.xml', Buffer.from(sectionXml));
    zip.addFile('activities/page_101/page.xml', Buffer.from(pageXml));
    zip.addFile('activities/assign_102/assign.xml', Buffer.from(assignXml));
    zip.addFile('questions.xml', Buffer.from(questionsXml));
    zip.addFile('activities/quiz_103/quiz.xml', Buffer.from(quizXml));

    const zipBuffer = zip.toBuffer();
    const parsed = await parseMoodleBackup(zipBuffer);

    expect(parsed.courseInfo.fullname).toBe('Fisika Dasar Kelas X');
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0].title).toBe('Bab 1: Kinematika Gerak');
    expect(parsed.pages).toHaveLength(1);
    expect(parsed.pages[0].title).toBe('Materi Pengantar Gerak');
    expect(parsed.assignments).toHaveLength(1);
    expect(parsed.assignments[0].title).toBe('Tugas Analisis Kecepatan');
    expect(parsed.quizzes).toHaveLength(1);
    expect(parsed.quizzes[0].durationMinutes).toBe(30);
    expect(parsed.quizzes[0].questions).toHaveLength(1);
    expect(parsed.quizzes[0].questions[0].options).toHaveLength(2);

    const preview = buildMoodlePreview(parsed);
    expect(preview.stats.totalModules).toBe(1);
    expect(preview.stats.totalPages).toBe(1);
    expect(preview.stats.totalAssignments).toBe(1);
    expect(preview.stats.totalQuizzes).toBe(1);
    expect(preview.stats.totalQuestions).toBe(1);
    expect(preview.modules[0].items).toHaveLength(3);
  });
});
