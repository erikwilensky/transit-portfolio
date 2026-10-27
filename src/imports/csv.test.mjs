// node --test src/imports
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv, sniffDelimiter } from './csv.js';
import { parseDate, studentMatcher, suggestLines, findCol, normHeader } from './common.js';

test('CSV: BOM, CRLF, quotes, commas and doubled quotes', () => {
  const rows = parseCsv('﻿Name,Note\r\n"Chen, Maya","She said ""hi"""\r\n\r\nPlain , trimmed \r\n');
  assert.deepEqual(rows, [['Name', 'Note'], ['Chen, Maya', 'She said "hi"'], ['Plain', 'trimmed']]);
});

test('CSV: line breaks inside a quoted cell, LF and old Mac CR endings', () => {
  assert.deepEqual(parseCsv('a,b\n"one\r\ntwo",3\n'), [['a', 'b'], ['one\ntwo', '3']]);
  assert.deepEqual(parseCsv('a,b\rc,d'), [['a', 'b'], ['c', 'd']]);
});

test('CSV: Thai text survives untouched', () => {
  const rows = parseCsv('ชื่อ,นามสกุล\r\nปิ่น,ชัยพร\r\n');
  assert.equal(rows[1][0], 'ปิ่น');
  assert.equal(rows[1][1], 'ชัยพร');
});

test('CSV: semicolon and tab files are detected', () => {
  assert.equal(sniffDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(sniffDelimiter('a\tb\n1\t2'), '\t');
  assert.equal(sniffDelimiter('"x;y",b\n'), ',');
  assert.deepEqual(parseCsv('a;b\n"1;2";3'), [['a', 'b'], ['1;2', '3']]);
});

test('CSV: a trailing empty cell is kept, a missing final newline is fine', () => {
  assert.deepEqual(parseCsv('a,b,c\n1,,'), [['a', 'b', 'c'], ['1', '', '']]);
});

test('CSV: toCsv round-trips awkward values', () => {
  const rows = [['a,b', 'say "x"', 'two\nlines', 'ไทย']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});

test('Dates: ISO, day-first slashes, US when it must be, words, Buddhist Era, serials', () => {
  assert.equal(parseDate('2026-10-05'), '2026-10-05');
  assert.equal(parseDate('2026-10-05T09:00:00Z'), '2026-10-05');
  assert.equal(parseDate('05/10/2026'), '2026-10-05');
  assert.equal(parseDate('10/14/2026'), '2026-10-14'); // cannot be day-first
  assert.equal(parseDate('5.10.26'), '2026-10-05');
  assert.equal(parseDate('02/10/2569'), '2026-10-02'); // B.E.
  assert.equal(parseDate('Oct 12, 2026'), '2026-10-12');
  assert.equal(parseDate('Mon, 12 October 2026'), '2026-10-12');
  assert.equal(parseDate('20261018'), '2026-10-18');
  assert.equal(parseDate('46309'), '2026-10-14');
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate('sometime'), null);
  assert.equal(parseDate(''), null);
});

test('Headers: exact match first, then longer names that contain the alias', () => {
  const h = ['First Name', 'Last Name', 'Student Email Address', 'CAS Experience Name'];
  assert.equal(findCol(h, ['Email']), 2);
  assert.equal(findCol(h, ['Name']), -1); // never grabs "CAS Experience Name" for a student name
  assert.equal(normHeader(' Status of the Activity '), 'statusoftheactivity');
});

const STUDENTS = [
  { id: 'st-01', name: 'Maya Chen', laneOrder: ['maya-swim', 'science', 'computing', 'service'] },
  { id: 'st-09', name: 'Pim Chaiyaporn', nameTh: 'ปิ่น ชัยพร', laneOrder: ['sport'] },
  { id: 'st-30', name: 'Alex Kim', email: 'akim@nist.example', laneOrder: [] },
  { id: 'st-31', name: 'Alex Kim', laneOrder: [] },
];
const LINES = [{ id: 'maya-swim', name: 'Swimming', parentLineId: 'sport' }, { id: 'science', name: 'Science' }, { id: 'sport', name: 'Sport' }];

test('Students: matched by id, email or exact name, never guessed', () => {
  const m = studentMatcher(STUDENTS);
  assert.equal(m({ studentId: 'ST-01' }).student.id, 'st-01');
  assert.equal(m({ email: 'MAYA.CHEN@student.nist.ac.th' }).student.id, 'st-01');
  assert.equal(m({ email: 'mailto:akim@nist.example' }).student.id, 'st-30');
  assert.equal(m({ first: 'Maya', last: 'Chen' }).student.id, 'st-01');
  assert.equal(m({ name: 'Chen, Maya' }).student.id, 'st-01');
  assert.equal(m({ name: 'ปิ่น  ชัยพร' }).student.id, 'st-09');
  assert.equal(m({ name: 'Maya Che' }).student, undefined);
  assert.match(m({ name: 'Maya Che' }).problem, /No student found/);
  assert.match(m({ name: 'Alex Kim' }).problem, /2 students share/);
  assert.match(m({}).problem, /No student named/);
});

test('Lines: a sub-line wins when named, otherwise the school line, only from the student’s own lines', () => {
  const maya = STUDENTS[0];
  assert.deepEqual(suggestLines('Swimming gala, 100m freestyle', maya, LINES, { type: 'sport' }), ['maya-swim']);
  assert.deepEqual(suggestLines('Biology lab report', maya, LINES), ['science']);
  assert.deepEqual(suggestLines('Violin recital', maya, LINES), []); // Maya has no music line
  assert.deepEqual(suggestLines('ฟุตบอล กับ ISB', STUDENTS[1], LINES), ['sport']);
});
