// migration/fixCategories.ts
import mongoose from 'mongoose';
import Story from '../models/Story';
import Category from '../models/Category';
import '../loadEnv';

const migrateCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log('Connected to MongoDB');

    let defaultCategory = await Category.findOne({ name: 'Uncategorized' });
    if (!defaultCategory) {
      defaultCategory = await Category.create({
        name: 'Uncategorized',
        slug: 'uncategorized'
      });
      console.log('Created default category');
    }

    // Bulk update all stories with string categories
    const result = await Story.updateMany(
      { category: { $type: 'string' } },
      { category: defaultCategory._id }
    );

    console.log(`Updated ${result.modifiedCount} stories`);
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateCategories();