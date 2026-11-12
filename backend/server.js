const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { PORT } = require('./config/auth');
const authRoutes = require('./routes/authRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://paulesdemian732_db_user:nqne7WeuJPCfvVc1@cluster0.aupn4zp.mongodb.net/sundaySchoolDB?retryWrites=true&w=majority&appName=Cluster0';

let cachedPromise = null;
async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (!cachedPromise) {
    cachedPromise = mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000
    }).then((m) => {
      console.log('✅ متصل بقاعدة بيانات MongoDB Atlas السحابية بنجاح');
      return m;
    }).catch((err) => {
      cachedPromise = null;
      console.error('❌ خطأ في الاتصال بـ MongoDB:', err);
      throw err;
    });
  }
  return cachedPromise;
}

app.use('/api', async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    res.status(500).json({ error: 'فشل الاتصال بقاعدة البيانات السحابية' });
  }
});

const ChildSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  birthdate: { type: String, default: '' },
  photo: { type: String, default: '' },
  servant: { type: String, default: '' },
  records: { type: Map, of: Object, default: {} },
  notes: { type: Array, default: [] }
}, { timestamps: true });

const Child = mongoose.models.Child || mongoose.model('Child', ChildSchema);

const WeekSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  label: { type: String, default: '' },
  servant: { type: String, required: true },
  createdAt: { type: Number, default: () => Date.now() }
}, { timestamps: true });

const Week = mongoose.models.Week || mongoose.model('Week', WeekSchema);

app.use('/api', authRoutes);

app.get('/api/weeks', async (req, res) => {
  try {
    const weeks = await Week.find().sort({ createdAt: -1 });
    res.json(weeks);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب الأسابيع' });
  }
});

app.post('/api/weeks', async (req, res) => {
  try {
    const week = new Week(req.body);
    await week.save();
    try { io.emit('weekAdded', week); } catch (e) { }
    res.json(week);
  } catch (err) {
    res.status(500).json({ error: 'فشل في حفظ الأسبوع' });
  }
});

app.delete('/api/weeks/:id', async (req, res) => {
  try {
    const weekId = req.params.id;
    await Week.findOneAndDelete({ id: weekId });
    await Child.updateMany({}, { $unset: { [`records.${weekId}`]: "" } });
    try { io.emit('weekDeleted', weekId); } catch (e) { }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'فشل في حذف الأسبوع' });
  }
});

app.get('/api/children', async (req, res) => {
  try {
    const children = await Child.find();
    res.json(children);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب البيانات' });
  }
});

app.post('/api/children', async (req, res) => {
  try {
    const child = new Child(req.body);
    await child.save();
    try { io.emit('childAdded', child); } catch (e) { }
    res.json(child);
  } catch (err) {
    res.status(500).json({ error: 'فشل في إضافة الطفل' });
  }
});

app.put('/api/children/:id', async (req, res) => {
  try {
    const updated = await Child.findByIdAndUpdate(req.params.id, req.body, { new: true });
    try { io.emit('childUpdated', updated); } catch (e) { }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'فشل في تحديث بيانات الطفل' });
  }
});

app.put('/api/children/:id/record', async (req, res) => {
  try {
    const { id } = req.params;
    const { weekKey, data } = req.body;
    const child = await Child.findById(id);
    if (!child) return res.status(404).json({ error: 'الطفل غير موجود' });

    child.records.set(weekKey, data);
    await child.save();

    try { io.emit('recordUpdated', { id, weekKey, data }); } catch (e) { }
    res.json(child);
  } catch (err) {
    res.status(500).json({ error: 'فشل في تحديث النقاط' });
  }
});

app.delete('/api/children/:id', async (req, res) => {
  try {
    await Child.findByIdAndDelete(req.params.id);
    try { io.emit('childDeleted', req.params.id); } catch (e) { }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'فشل في حذف الطفل' });
  }
});

app.post('/api/children/:id/notes', async (req, res) => {
  try {
    const child = await Child.findById(req.params.id);
    if (!child) return res.status(404).json({ error: 'الطفل غير موجود' });

    if (!child.notes) child.notes = [];
    child.notes.unshift(req.body);
    await child.save();
    try { io.emit('noteAdded', { id: req.params.id, note: req.body }); } catch (e) { }
    res.json(child);
  } catch (err) {
    res.status(500).json({ error: 'فشل في إضافة الملاحظة' });
  }
});

io.on('connection', (socket) => {
  console.log('👤 مستخدم متصل لحظياً:', socket.id);
});

module.exports = app;