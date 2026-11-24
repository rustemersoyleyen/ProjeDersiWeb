/**
 * Yerel Geliştirme / Ön İzleme API Sunucusu (PHP/XAMPP kurulu olmayan bilgisayarlarda test için)
 * Canlı sunucuda (kiracbilisim.net) bunun yerine doğrudan api/index.php (PHP PDO + MySQL) çalışır.
 * Çalıştırma: npm run dev:api
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_FILE = path.join(__dirname, 'dev-db.json');

function parseSqlQuestions() {
  const sql = fs.readFileSync(path.join(ROOT, 'database', 'seed_questions.sql'), 'utf8');
  const rows = [];
  const regex = /\((\d+),\s*(\d+),\s*'((?:[^']|'')*)',\s*'(kolay|orta|zor)',\s*'((?:[^']|'')*)'\)/g;
  let m;
  while ((m = regex.exec(sql)) !== null) {
    rows.push({
      id: Number(m[1]),
      course_id: Number(m[2]),
      question_text: m[3].replace(/''/g, "'"),
      difficulty: m[4],
      expected_hint: m[5].replace(/''/g, "'"),
    });
  }
  return rows;
}

function parseSqlCriteria() {
  const sql = fs.readFileSync(path.join(ROOT, 'database', 'schema.sql'), 'utf8');
  const rows = [];
  const regex = /\((\d+),\s*(\d+),\s*(\d+),\s*'((?:[^']|'')*)',\s*([0-9.]+),\s*'(\[[\s\S]*?\])',\s*(\d+)\)/g;
  let m;
  while ((m = regex.exec(sql)) !== null) {
    rows.push({
      id: Number(m[1]),
      course_id: Number(m[2]),
      outcome_id: Number(m[3]),
      name: m[4].replace(/''/g, "'"),
      max_score: Number(m[5]),
      rubric_levels: JSON.parse(m[6]),
      sort_order: Number(m[7]),
    });
  }
  return rows;
}

function createInitialDb() {
  return {
    nextId: 500,
    settings: {
      school_name: 'Mesleki ve Teknik Anadolu Lisesi - Bilişim Teknolojileri Alanı',
      academic_year: '2025-2026',
      evaluation_title: 'PROJE DEĞERLENDİRME VE RUBİK FORMU',
    },
    users: [
      {
        id: 1,
        username: 'admin',
        password: 'admin123',
        full_name: 'Sistem Yöneticisi',
        branch: 'Bilişim Teknolojileri',
        title: 'Alan Şefi / Yönetici',
        role: 'admin',
        is_active: 1,
        must_change_password: 1,
      },
    ],
    courses: [
      { id: 1, name: '1.Dönem 1.Uygulama (Nesne Tabanlı Programlama)', short_code: '1.Dönem 1.Uyg.', description: 'Sınıf, nesne, kapsülleme, kalıtım projeleri', question_points: 20, sort_order: 1 },
      { id: 2, name: '1.Dönem 2.Uygulama (FrontEnd Web Tasarımı)', short_code: '1.Dönem 2.Uyg.', description: 'HTML, CSS, JavaScript arayüz projeleri', question_points: 20, sort_order: 2 },
      { id: 3, name: '2.Dönem 1.Uygulama (Web Tabanlı Proje)', short_code: '2.Dönem 1.Uyg.', description: 'Backend, veritabanı, CRUD web projeleri', question_points: 20, sort_order: 3 },
      { id: 4, name: '2.Dönem 2.Uygulama (Mobil Uygulama)', short_code: '2.Dönem 2.Uyg.', description: 'Mobil ekran akışı ve veri yönetimi projeleri', question_points: 20, sort_order: 4 },
    ],
    outcomes: [
      { id: 1, code: 'K1', name: 'Planlama', description: 'Proje kapsamı, analiz ve iş-zaman planlaması', default_weight: 15, is_question_outcome: 0, sort_order: 1 },
      { id: 2, code: 'K2', name: 'Tasarım', description: 'Arayüz, mimari ve kullanıcı deneyimi tasarımı', default_weight: 20, is_question_outcome: 0, sort_order: 2 },
      { id: 3, code: 'K3', name: 'Kodlama', description: 'Çalışan işlevsellik, temiz kod ve hata kontrolü', default_weight: 35, is_question_outcome: 0, sort_order: 3 },
      { id: 4, code: 'K4', name: 'Rapor', description: 'Proje dokümantasyonu, ekran görüntüleri ve düzen', default_weight: 10, is_question_outcome: 0, sort_order: 4 },
      { id: 5, code: 'K5', name: 'Teknik Soru/Cevap', description: 'Rastgele gelen 3 teknik sorunun yanıtlanması', default_weight: 20, is_question_outcome: 1, sort_order: 5 },
    ],
    criteria: parseSqlCriteria(),
    questions: parseSqlQuestions(),
    classes: [],
    class_course_teachers: [],
    projects: [],
    students: [],
    student_questions: [],
    evaluations: [],
    evaluation_scores: [],
  };
}

let db = fs.existsSync(DB_FILE)
  ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  : createInitialDb();

const saveDb = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const nextId = () => ++db.nextId;
const sessions = new Map();

function send(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function getSessionUser(req, url) {
  const qToken = url?.searchParams.get('_token');
  if (qToken && sessions.has(qToken)) {
    const uid = sessions.get(qToken);
    return db.users.find((u) => u.id === uid && u.is_active === 1) || null;
  }
  const token = req.headers['x-auth-token'];
  if (token && sessions.has(String(token))) {
    const uid = sessions.get(String(token));
    return db.users.find((u) => u.id === uid && u.is_active === 1) || null;
  }
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/PD_DEV_SID=([^;]+)/);
  if (!m) return null;
  const uid = sessions.get(m[1]);
  return db.users.find((u) => u.id === uid && u.is_active === 1) || null;
}

function splitPoints(total) {
  const base = Math.floor(total / 3);
  const rem = total % 3;
  return [base + (rem >= 1 ? 1 : 0), base + (rem >= 2 ? 1 : 0), base];
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1:8080');
  const route = (url.searchParams.get('route') || '').replace(/^\/+|\/+$/g, '');
  const [resource, sub] = route.split('/');
  const rawMethod = req.method || 'GET';
  const overrideMethod = rawMethod === 'POST' ? (url.searchParams.get('_method') || '').toUpperCase() : '';
  const method = ['PUT', 'DELETE'].includes(overrideMethod) ? overrideMethod : rawMethod;
  const body = ['POST', 'PUT', 'DELETE'].includes(method) ? await readBody(req) : {};
  const user = getSessionUser(req, url);

  if (resource === 'health') {
    return send(res, { ok: true, db: 'connected', courses: db.courses.length, questions: db.questions.length });
  }

  if (resource === 'auth') {
    if (sub === 'me' && method === 'GET') {
      if (!user) return send(res, { authenticated: false, user: null });
      const { password: _, ...safeUser } = user;
      return send(res, {
        authenticated: true,
        user: safeUser,
        settings: db.settings,
        courses: db.courses,
        outcomes: db.outcomes,
      });
    }
    if (sub === 'login' && method === 'POST') {
      const found = db.users.find(
        (u) => u.username === String(body.username || '').trim() && u.password === body.password && u.is_active === 1
      );
      if (!found) return send(res, { error: 'Kullanıcı adı veya şifre hatalı.' }, 401);
      const sid = Math.random().toString(36).slice(2);
      sessions.set(sid, found.id);
      res.setHeader('Set-Cookie', `PD_DEV_SID=${sid}; Path=/; HttpOnly; SameSite=Lax`);
      const { password: _, ...safeUser } = found;
      return send(res, { ok: true, token: sid, user: safeUser });
    }
    if (sub === 'logout' && method === 'POST') {
      res.setHeader('Set-Cookie', 'PD_DEV_SID=; Path=/; Max-Age=0');
      return send(res, { ok: true });
    }
    if (sub === 'change-password' && method === 'POST') {
      if (!user) return send(res, { error: 'Oturum gerekli.' }, 401);
      if (user.password !== body.current_password) return send(res, { error: 'Mevcut şifre hatalı.' }, 400);
      user.password = body.new_password;
      user.must_change_password = 0;
      saveDb();
      return send(res, { ok: true });
    }
  }

  if (!user) return send(res, { error: 'Oturum gerekli.' }, 401);

  if (resource === 'settings') {
    if (method === 'GET') return send(res, db.settings);
    db.settings = { ...db.settings, ...body };
    saveDb();
    return send(res, { ok: true });
  }

  if (resource === 'users') {
    if (method === 'GET') return send(res, db.users.map(({ password: _, ...u }) => u));
    if (method === 'POST') {
      const item = { id: nextId(), ...body, is_active: 1, must_change_password: 0 };
      db.users.push(item);
      saveDb();
      return send(res, { ok: true, id: item.id }, 201);
    }
    if (method === 'PUT') {
      const u = db.users.find((x) => x.id === Number(body.id));
      if (u) {
        u.full_name = body.full_name;
        u.branch = body.branch;
        u.title = body.title;
        u.role = body.role;
        u.is_active = body.is_active ?? 1;
        if (body.password) u.password = body.password;
        saveDb();
      }
      return send(res, { ok: true });
    }
    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id') || body.id);
      db.users = db.users.filter((x) => x.id !== id);
      saveDb();
      return send(res, { ok: true });
    }
  }

  if (resource === 'courses') {
    if (method === 'GET') return send(res, db.courses);
    if (method === 'POST') {
      const item = { id: nextId(), ...body };
      db.courses.push(item);
      saveDb();
      return send(res, { ok: true, id: item.id }, 201);
    }
    if (method === 'PUT') {
      const c = db.courses.find((x) => x.id === Number(body.id));
      if (c) Object.assign(c, body);
      saveDb();
      return send(res, { ok: true });
    }
    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id') || body.id);
      db.courses = db.courses.filter((x) => x.id !== id);
      saveDb();
      return send(res, { ok: true });
    }
  }

  if (resource === 'classes') {
    if (method === 'GET') {
      const out = db.classes.map((c) => {
        const course_teachers = {};
        for (const ct of db.class_course_teachers.filter((x) => x.class_id === c.id)) {
          const t = db.users.find((u) => u.id === ct.teacher_id);
          if (!t) continue;
          course_teachers[ct.course_id] = course_teachers[ct.course_id] || [];
          course_teachers[ct.course_id].push({
            teacher_id: t.id,
            full_name: t.full_name,
            branch: t.branch,
            title: t.title,
          });
        }
        return {
          ...c,
          student_count: db.students.filter((s) => s.class_id === c.id).length,
          course_teachers,
        };
      });
      return send(res, out);
    }
    if (method === 'POST') {
      const item = { id: nextId(), name: body.name, academic_year: body.academic_year || '2025-2026', school_name: body.school_name || '' };
      db.classes.push(item);
      saveDb();
      return send(res, { ok: true, id: item.id }, 201);
    }
    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id') || body.id);
      db.classes = db.classes.filter((x) => x.id !== id);
      db.students = db.students.filter((s) => s.class_id !== id);
      saveDb();
      return send(res, { ok: true });
    }
  }

  if (resource === 'class-teachers' && method === 'POST') {
    db.class_course_teachers = db.class_course_teachers.filter(
      (x) => !(x.class_id === Number(body.class_id) && x.course_id === Number(body.course_id))
    );
    (body.teacher_ids || []).forEach((tid, idx) => {
      db.class_course_teachers.push({
        class_id: Number(body.class_id),
        course_id: Number(body.course_id),
        teacher_id: Number(tid),
        sort_order: idx + 1,
      });
    });
    saveDb();
    return send(res, { ok: true });
  }

  if (resource === 'projects') {
    if (method === 'GET') {
      return send(
        res,
        db.projects.map((p) => ({
          ...p,
          student_count: db.students.filter((s) => s.project_id === p.id).length,
        }))
      );
    }
    if (method === 'POST') {
      if (Array.isArray(body.items)) {
        body.items.forEach((it) => {
          db.projects.push({ id: nextId(), title: it.title || it, description: it.description || null });
        });
        saveDb();
        return send(res, { ok: true, inserted: body.items.length }, 201);
      }
      const item = { id: nextId(), title: body.title, description: body.description || null };
      db.projects.push(item);
      saveDb();
      return send(res, { ok: true, id: item.id }, 201);
    }
    if (method === 'PUT') {
      const p = db.projects.find((x) => x.id === Number(body.id));
      if (p) {
        p.title = body.title;
        p.description = body.description || null;
        saveDb();
      }
      return send(res, { ok: true });
    }
    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id') || body.id);
      db.projects = db.projects.filter((x) => x.id !== id);
      db.students.forEach((s) => {
        if (s.project_id === id) s.project_id = null;
      });
      saveDb();
      return send(res, { ok: true });
    }
  }

  if (resource === 'students') {
    if (method === 'GET') {
      const cid = Number(url.searchParams.get('class_id') || 0);
      const list = db.students
        .filter((s) => !cid || s.class_id === cid)
        .map((s) => {
          const proj = db.projects.find((p) => p.id === s.project_id);
          const cls = db.classes.find((c) => c.id === s.class_id);
          const evaluations = {};
          db.evaluations
            .filter((e) => e.student_id === s.id)
            .forEach((e) => {
              evaluations[e.course_id] = {
                total_score: e.total_score,
                rubric_total: e.rubric_total,
                question_total: e.question_total,
              };
            });
          const question_counts = {};
          db.student_questions
            .filter((q) => q.student_id === s.id)
            .forEach((q) => {
              question_counts[q.course_id] = (question_counts[q.course_id] || 0) + 1;
            });
          return {
            ...s,
            project_title: proj?.title || null,
            class_name: cls?.name || '',
            evaluations,
            question_counts,
          };
        });
      return send(res, list);
    }
    if (method === 'POST') {
      const classId = Number(body.class_id);
      if (Array.isArray(body.students)) {
        let count = 0;
        for (const row of body.students) {
          let pid = row.project_id || null;
          if (!pid && row.project_title) {
            let p = db.projects.find((x) => x.title === row.project_title);
            if (!p) {
              p = { id: nextId(), title: row.project_title, description: null };
              db.projects.push(p);
            }
            pid = p.id;
          }
          const existing = db.students.find((s) => s.class_id === classId && s.student_no === String(row.student_no));
          if (existing) {
            existing.full_name = row.full_name;
          } else {
            db.students.push({ id: nextId(), class_id: classId, student_no: String(row.student_no), full_name: row.full_name, project_id: pid });
          }
          count++;
        }
        saveDb();
        return send(res, { ok: true, imported: count }, 201);
      }
      const item = {
        id: nextId(),
        class_id: classId,
        student_no: String(body.student_no),
        full_name: body.full_name,
        project_id: body.project_id ? Number(body.project_id) : null,
      };
      db.students.push(item);
      saveDb();
      return send(res, { ok: true, id: item.id }, 201);
    }
    if (method === 'PUT') {
      const s = db.students.find((x) => x.id === Number(body.id));
      if (s) {
        if (body.student_no !== undefined) s.student_no = body.student_no;
        if (body.full_name !== undefined) s.full_name = body.full_name;
        if ('project_id' in body) s.project_id = body.project_id ? Number(body.project_id) : null;
        saveDb();
      }
      return send(res, { ok: true });
    }
    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id') || body.id);
      db.students = db.students.filter((x) => x.id !== id);
      saveDb();
      return send(res, { ok: true });
    }
  }

  if (resource === 'criteria') {
    if (method === 'GET') {
      const cid = Number(url.searchParams.get('course_id') || 0);
      return send(res, {
        outcomes: db.outcomes,
        criteria: db.criteria.filter((c) => !cid || c.course_id === cid),
      });
    }
    if (method === 'POST') {
      const item = { id: nextId(), ...body, sort_order: body.sort_order || 10 };
      db.criteria.push(item);
      saveDb();
      return send(res, { ok: true, id: item.id }, 201);
    }
    if (method === 'PUT') {
      const c = db.criteria.find((x) => x.id === Number(body.id));
      if (c) Object.assign(c, body);
      saveDb();
      return send(res, { ok: true });
    }
    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id') || body.id);
      db.criteria = db.criteria.filter((x) => x.id !== id);
      saveDb();
      return send(res, { ok: true });
    }
  }

  if (resource === 'questions') {
    if (method === 'GET') {
      const cid = Number(url.searchParams.get('course_id') || 0);
      return send(res, db.questions.filter((q) => !cid || q.course_id === cid));
    }
    if (method === 'POST') {
      if (Array.isArray(body.items)) {
        body.items.forEach((it) => {
          db.questions.push({
            id: nextId(),
            course_id: Number(body.course_id),
            question_text: it.question_text,
            difficulty: it.difficulty || 'kolay',
            expected_hint: it.expected_hint || null,
          });
        });
        saveDb();
        return send(res, { ok: true, inserted: body.items.length }, 201);
      }
      const item = { id: nextId(), ...body };
      db.questions.push(item);
      saveDb();
      return send(res, { ok: true, id: item.id }, 201);
    }
    if (method === 'PUT') {
      const q = db.questions.find((x) => x.id === Number(body.id));
      if (q) Object.assign(q, body);
      saveDb();
      return send(res, { ok: true });
    }
    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id') || body.id);
      db.questions = db.questions.filter((x) => x.id !== id);
      saveDb();
      return send(res, { ok: true });
    }
  }

  if (resource === 'student-questions') {
    if (sub === 'assign-random' && method === 'POST') {
      const courseId = Number(body.course_id);
      const course = db.courses.find((c) => c.id === courseId);
      const pool = db.questions.filter((q) => q.course_id === courseId);
      if (pool.length < 3) return send(res, { error: 'En az 3 soru gerekli.' }, 400);
      const pts = splitPoints(course?.question_points ?? 20);
      const targets = body.student_id
        ? [Number(body.student_id)]
        : db.students.filter((s) => s.class_id === Number(body.class_id)).map((s) => s.id);
      let assigned = 0;
      for (const sid of targets) {
        const cur = db.student_questions.filter((x) => x.student_id === sid && x.course_id === courseId);
        if (cur.length >= 3 && !body.force) continue;
        db.student_questions = db.student_questions.filter((x) => !(x.student_id === sid && x.course_id === courseId));
        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
        shuffled.forEach((q, idx) => {
          db.student_questions.push({
            id: nextId(),
            student_id: sid,
            course_id: courseId,
            question_id: q.id,
            sort_order: idx + 1,
            max_score: pts[idx],
            score: null,
            note: null,
          });
        });
        assigned++;
      }
      saveDb();
      return send(res, { ok: true, assigned_students: assigned });
    }
    if (sub === 'replace' && method === 'POST') {
      const sq = db.student_questions.find((x) => x.id === Number(body.student_question_id));
      if (sq) {
        sq.question_id = Number(body.new_question_id);
        sq.score = null;
        saveDb();
      }
      return send(res, { ok: true });
    }
  }

  if (resource === 'evaluations') {
    if (method === 'GET') {
      const sid = Number(url.searchParams.get('student_id'));
      const cid = Number(url.searchParams.get('course_id'));
      const s = db.students.find((x) => x.id === sid);
      const cls = db.classes.find((x) => x.id === s?.class_id);
      const proj = db.projects.find((x) => x.id === s?.project_id);
      const course = db.courses.find((x) => x.id === cid);
      const criteria = db.criteria.filter((c) => c.course_id === cid);
      const questions = db.student_questions
        .filter((sq) => sq.student_id === sid && sq.course_id === cid)
        .map((sq) => {
          const q = db.questions.find((x) => x.id === sq.question_id);
          return { ...sq, question_text: q?.question_text || '', difficulty: q?.difficulty, expected_hint: q?.expected_hint };
        });
      const evaluation = db.evaluations.find((e) => e.student_id === sid && e.course_id === cid) || null;
      const scores = {};
      if (evaluation) {
        db.evaluation_scores
          .filter((es) => es.evaluation_id === evaluation.id)
          .forEach((es) => {
            scores[es.criterion_id] = { selected_level: es.selected_level, score: es.score };
          });
      }
      const teachers = db.class_course_teachers
        .filter((x) => x.class_id === s?.class_id && x.course_id === cid)
        .map((x) => db.users.find((u) => u.id === x.teacher_id))
        .filter(Boolean);
      return send(res, {
        student: { ...s, project_title: proj?.title || null, class_name: cls?.name || '', academic_year: cls?.academic_year || '', school_name: cls?.school_name || '' },
        course,
        criteria,
        questions,
        evaluation,
        scores,
        teachers,
      });
    }
    if (method === 'POST') {
      const sid = Number(body.student_id);
      const cid = Number(body.course_id);
      const rubric_total = (body.criteria_scores || []).reduce((a, b) => a + Number(b.score || 0), 0);
      const question_total = (body.question_scores || []).reduce((a, b) => a + (b.score !== null ? Number(b.score || 0) : 0), 0);
      const total_score = Number((rubric_total + question_total).toFixed(2));
      let ev = db.evaluations.find((e) => e.student_id === sid && e.course_id === cid);
      if (!ev) {
        ev = { id: nextId(), student_id: sid, course_id: cid, evaluator_id: user.id, evaluated_at: new Date().toISOString() };
        db.evaluations.push(ev);
      }
      ev.rubric_total = rubric_total;
      ev.question_total = question_total;
      ev.total_score = total_score;
      ev.notes = body.notes || null;

      db.evaluation_scores = db.evaluation_scores.filter((es) => es.evaluation_id !== ev.id);
      (body.criteria_scores || []).forEach((cs) => {
        db.evaluation_scores.push({
          evaluation_id: ev.id,
          criterion_id: Number(cs.criterion_id),
          selected_level: cs.selected_level ?? null,
          score: Number(cs.score || 0),
        });
      });
      (body.question_scores || []).forEach((qs) => {
        const sq = db.student_questions.find((x) => x.id === Number(qs.id));
        if (sq) {
          sq.score = qs.score !== null ? Number(qs.score) : null;
          sq.note = qs.note || null;
        }
      });
      saveDb();
      return send(res, { ok: true, evaluation_id: ev.id, rubric_total, question_total, total_score });
    }
  }

  if (resource === 'matrix') {
    const cid = Number(url.searchParams.get('class_id') || 0);
    const rows = db.students
      .filter((s) => cid && s.class_id === cid)
      .map((s) => {
        const proj = db.projects.find((p) => p.id === s.project_id);
        const scores = {};
        const vals = [];
        db.evaluations
          .filter((e) => e.student_id === s.id)
          .forEach((e) => {
            scores[e.course_id] = e.total_score;
            vals.push(e.total_score);
          });
        return {
          id: s.id,
          student_no: s.student_no,
          full_name: s.full_name,
          project_title: proj?.title || null,
          scores,
          average: vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null,
        };
      });
    return send(res, {
      stats: {
        classes: db.classes.length,
        students: db.students.length,
        projects: db.projects.length,
        questions: db.questions.length,
        evaluations: db.evaluations.length,
        teachers: db.users.filter((u) => u.is_active === 1).length,
      },
      courses: db.courses,
      rows,
    });
  }

  if (resource === 'print-data') {
    const classId = Number(url.searchParams.get('class_id'));
    const courseId = Number(url.searchParams.get('course_id'));
    const class_info = db.classes.find((c) => c.id === classId);
    const course = db.courses.find((c) => c.id === courseId);
    const teachers = db.class_course_teachers
      .filter((x) => x.class_id === classId && x.course_id === courseId)
      .map((x) => db.users.find((u) => u.id === x.teacher_id))
      .filter(Boolean);
    const criteria = db.criteria.filter((c) => c.course_id === courseId);
    const students = db.students
      .filter((s) => s.class_id === classId)
      .map((s) => {
        const proj = db.projects.find((p) => p.id === s.project_id);
        const questions = db.student_questions
          .filter((sq) => sq.student_id === s.id && sq.course_id === courseId)
          .map((sq) => {
            const q = db.questions.find((x) => x.id === sq.question_id);
            return { sort_order: sq.sort_order, question_text: q?.question_text || '', max_score: sq.max_score, score: sq.score };
          });
        const evaluation = db.evaluations.find((e) => e.student_id === s.id && e.course_id === courseId) || null;
        const criterion_scores = {};
        if (evaluation) {
          db.evaluation_scores
            .filter((es) => es.evaluation_id === evaluation.id)
            .forEach((es) => (criterion_scores[es.criterion_id] = es.score));
        }
        return { id: s.id, student_no: s.student_no, full_name: s.full_name, project_title: proj?.title || null, questions, evaluation, criterion_scores };
      });
    return send(res, { class_info, course, settings: db.settings, teachers, outcomes: db.outcomes, criteria, students });
  }

  send(res, { error: 'Bilinmeyen rota: ' + route }, 404);
});

server.listen(8080, '127.0.0.1', () => {
  console.log(`Yerel Dev API hazır: http://127.0.0.1:8080 (${db.questions.length} teknik soru yüklendi)`);
});
