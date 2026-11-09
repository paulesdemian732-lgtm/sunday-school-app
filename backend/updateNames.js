const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://paulesdemian732_db_user:nqne7WeuJPCfvVc1@cluster0.aupn4zp.mongodb.net/sundaySchoolDB?retryWrites=true&w=majority&appName=Cluster0';

async function updateAllServants() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ متصل بقاعدة البيانات...');

        const db = mongoose.connection.db;

        // 1. تحديث أسماء الخدام في قائمة الأطفال
        await db.collection('children').updateMany({ servant: 'بولس' }, { $set: { servant: 'بولس دميان' } });
        await db.collection('children').updateMany({ servant: 'مريم' }, { $set: { servant: 'مريم باشا' } });
        await db.collection('children').updateMany({ servant: 'مارلين' }, { $set: { servant: 'مارلين نزيه' } });

        // 2. تحديث أسماء الخدام في جدول الأسابيع
        await db.collection('weeks').updateMany({ servant: 'بولس' }, { $set: { servant: 'بولس دميان' } });
        await db.collection('weeks').updateMany({ servant: 'مريم' }, { $set: { servant: 'مريم باشا' } });
        await db.collection('weeks').updateMany({ servant: 'مارلين' }, { $set: { servant: 'مارلين نزيه' } });

        console.log('🎉 تم تحديث كافة الأسماء لـ (بولس دميان - مريم باشا - مارلين نزيه) بنجاح!');
        process.exit(0);
    } catch (error) {
        console.error('❌ خطأ:', error);
        process.exit(1);
    }
}

updateAllServants();