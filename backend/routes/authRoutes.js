const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { SHARED_PASSWORD } = require('../config/auth');

// جدول الخدام وكلمات المرور في قاعدة البيانات
const ServantSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const Servant = mongoose.model('Servant', ServantSchema);

// تسجيل الدخول العام للموقع
router.post('/login', (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ success: false, message: 'يرجى إدخال كلمة المرور' });
    }
    if (password === SHARED_PASSWORD) {
        return res.json({
            success: true,
            message: 'تم تسجيل الدخول بنجاح',
            redirectUrl: '/views/select-user.html'
        });
    }
    return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
});

// فحص هل الخادم سجل كلمة مرور من قبل في قاعدة البيانات
router.get('/servant-status/:name', async (req, res) => {
    try {
        const servant = await Servant.findOne({ name: req.params.name });
        if (servant && servant.password) {
            return res.json({ hasPassword: true });
        }
        return res.json({ hasPassword: false });
    } catch (err) {
        return res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// تعيين كلمة المرور لأول مرة أو تسجيل الدخول
router.post('/servant-auth', async (req, res) => {
    const { name, password, isNew } = req.body;
    try {
        let servant = await Servant.findOne({ name });

        if (isNew) {
            // إذا كان الخادم موجوداً بالفعل ولديه كلمة مرور
            if (servant && servant.password) {
                return res.status(400).json({ success: false, message: 'تم تعيين كلمة مرور لهذا الخادم مسبقاً!' });
            }
            if (!servant) {
                servant = new Servant({ name, password });
            } else {
                servant.password = password;
            }
            await servant.save();
            return res.json({ success: true, message: 'تم حفظ كلمة المرور بنجاح' });
        } else {
            // التحقق من كلمة المرور السابقة
            if (!servant || servant.password !== password) {
                return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
            }
            return res.json({ success: true });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: 'خطأ في الاتصال بقاعدة البيانات' });
    }
});

module.exports = router;