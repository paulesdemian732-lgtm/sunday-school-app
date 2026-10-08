const express = require('express');
const router = express.Router();
const { SHARED_PASSWORD } = require('../config/auth');

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

    return res.status(401).json({
        success: false,
        message: 'كلمة المرور غير صحيحة'
    });
});

module.exports = router;