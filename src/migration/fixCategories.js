"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// migration/fixCategories.ts
const mongoose_1 = __importDefault(require("mongoose"));
const Story_1 = __importDefault(require("../src/models/Story"));
const Category_1 = __importDefault(require("../src/models/Category"));
require("../src/loadEnv");
const migrateCategories = async () => {
    try {
        await mongoose_1.default.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        let defaultCategory = await Category_1.default.findOne({ name: 'Uncategorized' });
        if (!defaultCategory) {
            defaultCategory = await Category_1.default.create({
                name: 'Uncategorized',
                slug: 'uncategorized'
            });
            console.log('Created default category');
        }
        // Bulk update all stories with string categories
        const result = await Story_1.default.updateMany({ category: { $type: 'string' } }, { category: defaultCategory._id });
        console.log(`Updated ${result.modifiedCount} stories`);
        console.log('Migration completed successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};
migrateCategories();
