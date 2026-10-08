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

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// الاتصال بقاعدة البيانات السحابية (MongoDB Atlas)
const MONGO_URI = 'mongodb+srv://paulesdemian732_db_user:nqne7WeuJPCfvVc1@cluster0.aupn4zp.mongodb.net/sundaySchoolDB?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ متصل بقاعدة بيانات MongoDB Atlas السحابية بنجاح'))
  .catch(err => console.error('❌ خطأ في الاتصال بـ MongoDB:', err));

// نموذج بيانات الأطفال في القاعدة
const ChildSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  birthdate: { type: String, default: '' },
  photo: { type: String, default: '' },
  servant: { type: String, default: '' },
  records: { type: Map, of: Object, default: {} },
  notes: { type: Array, default: [] }
}, { timestamps: true });

const Child = mongoose.model('Child', ChildSchema);

// نموذج بيانات الأسابيع في القاعدة لمزامنتها عبر كل الأجهزة
const WeekSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  label: { type: String, default: '' },
  servant: { type: String, required: true },
  createdAt: { type: Number, default: () => Date.now() }
}, { timestamps: true });

const Week = mongoose.model('Week', WeekSchema);

// مسارات المصادقة
app.use('/api', authRoutes);

// مسارات الأسابيع السحابية
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
    io.emit('weekAdded', week);
    res.json(week);
  } catch (err) {
    res.status(500).json({ error: 'فشل في حفظ الأسبوع' });
  }
});

// مسار حذف الأسبوع وتنظيف درجاته من الأطفال
app.delete('/api/weeks/:id', async (req, res) => {
  try {
    const weekId = req.params.id;
    await Week.findOneAndDelete({ id: weekId });
    
    // إزالة درجات هذا الأسبوع من جميع الأطفال
    await Child.updateMany(
      {},
      { $unset: { [`records.${weekId}`]: "" } }
    );

    io.emit('weekDeleted', weekId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'فشل في حذف الأسبوع' });
  }
});

// مسارات بيانات الأطفال
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
    io.emit('childAdded', child);
    res.json(child);
  } catch (err) {
    res.status(500).json({ error: 'فشل في إضافة الطفل' });
  }
});

app.put('/api/children/:id', async (req, res) => {
  try {
    const updated = await Child.findByIdAndUpdate(req.params.id, req.body, { new: true });
    io.emit('childUpdated', updated);
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
    
    io.emit('recordUpdated', { id, weekKey, data });
    res.json(child);
  } catch (err) {
    res.status(500).json({ error: 'فشل في تحديث النقاط' });
  }
});

app.delete('/api/children/:id', async (req, res) => {
  try {
    await Child.findByIdAndDelete(req.params.id);
    io.emit('childDeleted', req.params.id);
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
    io.emit('noteAdded', { id: req.params.id, note: req.body });
    res.json(child);
  } catch (err) {
    res.status(500).json({ error: 'فشل في إضافة الملاحظة' });
  }
});

io.on('connection', (socket) => {
  console.log('👤 مستخدم متصل لحظياً:', socket.id);
});

// ملفات الواجهة ومسارات الصفحات
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/views/login.html'));
});

app.get(['/login', '/login.html', '/views/login.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/views/login.html'));
});

app.get(['/select-user', '/select-user.html', '/views/select-user.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/views/select-user.html'));
});

app.get(['/class', '/class.html', '/servant-class/class.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/servant-class/class.html'));
});

app.get(['/stats', '/stats.html', '/all-kids-stats/stats', '/all-kids-stats/stats.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/all-kids-stats/stats.html'));
});

app.get(['/honor', '/honor.html', '/honor-board/honor', '/honor-board/honor.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/honor-board/honor.html'));
});

app.get(['/admin', '/admin.html', '/views/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/views/admin.html'));
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});