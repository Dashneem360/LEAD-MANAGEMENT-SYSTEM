const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');

let mongod = null;
const isProduction = process.env.NODE_ENV === 'production';
const isLocalMongoUri = (uri = '') => /mongodb:\/\/(localhost|127\.0\.0\.1)/i.test(uri);

const seedAdmin = async () => {
  const User = require('../models/User');
  const existing = await User.findOne({ email: 'admin@dashneem.com' });
  if (!existing) {
    await User.create({
      name: 'Admin',
      email: 'admin@dashneem.com',
      password: 'admin@123',
      role: 'admin',
      companyCode: 'DASHNEEM',
      isActive: true
    });
    console.log('✅ Admin user created  →  admin@dashneem.com / admin@123');
  }
};

const seedLeads = async () => {
  const Lead = require('../models/Lead');
  const count = await Lead.countDocuments();
  if (count > 0) return;

  const today = new Date();
  const daysAgo = (n) => new Date(today - n * 86400000);
  const daysAhead = (n) => new Date(today.getTime() + n * 86400000);

  const leads = [
    { name: 'Rahul Sharma', phone: '9876543210', email: 'rahul.sharma@gmail.com', city: 'Mumbai', state: 'Maharashtra', source: 'website', status: 'new', priority: 'high', product: 'Stock Market Course', dealValue: 15000, latestRemark: 'Very interested, called twice', callCount: 2, nextFollowupDate: daysAhead(1), tags: ['hot-lead'] },
    { name: 'Priya Patel', phone: '9123456780', email: 'priya.patel@yahoo.com', city: 'Ahmedabad', state: 'Gujarat', source: 'referral', status: 'contacted', priority: 'high', product: 'Options Trading', dealValue: 20000, latestRemark: 'Asked for demo, scheduled for tomorrow', callCount: 3, nextFollowupDate: daysAhead(1), tags: ['demo-scheduled'] },
    { name: 'Amit Verma', phone: '9988776655', email: 'amit.verma@outlook.com', city: 'Delhi', state: 'Delhi', source: 'social_media', status: 'interested', priority: 'high', product: 'Crypto Masterclass', dealValue: 12000, latestRemark: 'Ready to pay, waiting for invoice', callCount: 5, nextFollowupDate: daysAhead(0), tags: ['hot-lead', 'invoice-pending'] },
    { name: 'Sunita Rao', phone: '8765432109', email: 'sunita.rao@gmail.com', city: 'Bangalore', state: 'Karnataka', source: 'google_sheet', status: 'nurturing', priority: 'medium', product: 'Mutual Funds Course', dealValue: 8000, latestRemark: 'Said will decide after salary credit', callCount: 4, nextFollowupDate: daysAhead(3), tags: ['nurturing'] },
    { name: 'Vikram Singh', phone: '7654321098', email: 'vikram.singh@gmail.com', city: 'Jaipur', state: 'Rajasthan', source: 'manual', status: 'converted', priority: 'high', product: 'Stock Market Course', dealValue: 15000, commission: 1500, latestRemark: 'Payment received, enrolled', callCount: 6, tags: ['converted', 'paid'] },
    { name: 'Neha Gupta', phone: '6543210987', email: 'neha.gupta@gmail.com', city: 'Lucknow', state: 'Uttar Pradesh', source: 'website', status: 'not_interested', priority: 'low', product: 'Options Trading', dealValue: 0, latestRemark: 'Not interested, too expensive', callCount: 2, tags: ['cold'] },
    { name: 'Rajesh Kumar', phone: '9871234560', email: 'rajesh.kumar@rediffmail.com', city: 'Patna', state: 'Bihar', source: 'referral', status: 'new', priority: 'medium', product: 'Crypto Masterclass', dealValue: 12000, latestRemark: 'Referred by Vikram Singh', callCount: 1, nextFollowupDate: daysAhead(2) },
    { name: 'Meera Nair', phone: '9562345670', email: 'meera.nair@gmail.com', city: 'Kochi', state: 'Kerala', source: 'social_media', status: 'contacted', priority: 'medium', product: 'Mutual Funds Course', dealValue: 8000, latestRemark: 'Interested but wants more info', callCount: 2, nextFollowupDate: daysAhead(1) },
    { name: 'Suresh Reddy', phone: '9345678901', email: 'suresh.reddy@gmail.com', city: 'Hyderabad', state: 'Telangana', source: 'website', status: 'interested', priority: 'high', product: 'Stock Market Course', dealValue: 15000, latestRemark: 'Wants payment plan options', callCount: 4, nextFollowupDate: daysAhead(0), tags: ['payment-plan'] },
    { name: 'Anjali Mehta', phone: '9234567891', email: 'anjali.mehta@gmail.com', city: 'Surat', state: 'Gujarat', source: 'google_sheet', status: 'converted', priority: 'high', product: 'Options Trading', dealValue: 20000, commission: 2000, latestRemark: 'Enrolled and payment done', callCount: 7, tags: ['converted', 'paid'] },
    { name: 'Manish Tiwari', phone: '8901234567', email: 'manish.tiwari@gmail.com', city: 'Bhopal', state: 'Madhya Pradesh', source: 'manual', status: 'nurturing', priority: 'medium', product: 'Crypto Masterclass', dealValue: 12000, latestRemark: 'Will confirm next week', callCount: 3, nextFollowupDate: daysAhead(5) },
    { name: 'Kavya Iyer', phone: '7890123456', email: 'kavya.iyer@gmail.com', city: 'Chennai', state: 'Tamil Nadu', source: 'referral', status: 'new', priority: 'low', product: 'Mutual Funds Course', dealValue: 8000, latestRemark: 'Just enquired, no callback yet', callCount: 0, nextFollowupDate: daysAhead(1) },
    { name: 'Deepak Joshi', phone: '6789012345', email: 'deepak.joshi@gmail.com', city: 'Pune', state: 'Maharashtra', source: 'website', status: 'contacted', priority: 'high', product: 'Stock Market Course', dealValue: 15000, latestRemark: 'Callback done, sending brochure', callCount: 2, nextFollowupDate: daysAhead(2) },
    { name: 'Pooja Sinha', phone: '9670123456', email: 'pooja.sinha@yahoo.com', city: 'Kolkata', state: 'West Bengal', source: 'social_media', status: 'lost', priority: 'low', product: 'Options Trading', dealValue: 0, latestRemark: 'Joined competitor course', callCount: 3, tags: ['lost-to-competitor'] },
    { name: 'Arjun Nambiar', phone: '9560123456', email: 'arjun.nambiar@gmail.com', city: 'Thrissur', state: 'Kerala', source: 'google_sheet', status: 'interested', priority: 'high', product: 'Crypto Masterclass', dealValue: 12000, latestRemark: 'Very keen, attending free webinar', callCount: 5, nextFollowupDate: daysAhead(0), tags: ['webinar-registered'] },
    { name: 'Shilpa Desai', phone: '8450123456', email: 'shilpa.desai@gmail.com', city: 'Vadodara', state: 'Gujarat', source: 'manual', status: 'new', priority: 'medium', product: 'Stock Market Course', dealValue: 15000, latestRemark: 'New enquiry from website form', callCount: 1, nextFollowupDate: daysAhead(1) },
    { name: 'Kiran Bhat', phone: '9340123456', email: 'kiran.bhat@gmail.com', city: 'Mangalore', state: 'Karnataka', source: 'referral', status: 'contacted', priority: 'medium', product: 'Mutual Funds Course', dealValue: 8000, latestRemark: 'Spoke for 10 min, keen on SIP course', callCount: 2, nextFollowupDate: daysAhead(3) },
    { name: 'Ravi Shankar', phone: '9230123456', email: 'ravi.shankar@gmail.com', city: 'Varanasi', state: 'Uttar Pradesh', source: 'website', status: 'nurturing', priority: 'low', product: 'Options Trading', dealValue: 20000, latestRemark: 'On the fence, needs more convincing', callCount: 4, nextFollowupDate: daysAhead(7) },
    { name: 'Ananya Roy', phone: '8120123456', email: 'ananya.roy@gmail.com', city: 'Guwahati', state: 'Assam', source: 'social_media', status: 'converted', priority: 'high', product: 'Mutual Funds Course', dealValue: 8000, commission: 800, latestRemark: 'Paid full amount, very happy', callCount: 4, tags: ['converted', 'paid'] },
    { name: 'Pankaj Dubey', phone: '7010123456', email: 'pankaj.dubey@gmail.com', city: 'Indore', state: 'Madhya Pradesh', source: 'referral', status: 'new', priority: 'high', product: 'Crypto Masterclass', dealValue: 12000, latestRemark: 'Hot referral from Ananya', callCount: 1, nextFollowupDate: daysAhead(0), tags: ['hot-lead'] },
    { name: 'Swati Kulkarni', phone: '9910123456', email: 'swati.kulkarni@gmail.com', city: 'Nagpur', state: 'Maharashtra', source: 'google_sheet', status: 'interested', priority: 'medium', product: 'Stock Market Course', dealValue: 15000, latestRemark: 'Wants group discount for family', callCount: 3, nextFollowupDate: daysAhead(2), tags: ['group-discount'] },
    { name: 'Tarun Malhotra', phone: '9800123456', email: 'tarun.malhotra@gmail.com', city: 'Chandigarh', state: 'Punjab', source: 'manual', status: 'contacted', priority: 'low', product: 'Mutual Funds Course', dealValue: 8000, latestRemark: 'Follow up after Diwali', callCount: 1, nextFollowupDate: daysAhead(4) },
    { name: 'Divya Menon', phone: '9700123456', email: 'divya.menon@gmail.com', city: 'Trivandrum', state: 'Kerala', source: 'website', status: 'not_interested', priority: 'low', product: 'Options Trading', dealValue: 0, latestRemark: 'Student, no income yet', callCount: 1, tags: ['student'] },
    { name: 'Sanjay Pandey', phone: '9600123456', email: 'sanjay.pandey@gmail.com', city: 'Allahabad', state: 'Uttar Pradesh', source: 'social_media', status: 'nurturing', priority: 'medium', product: 'Crypto Masterclass', dealValue: 12000, latestRemark: 'Will join after getting next salary', callCount: 3, nextFollowupDate: daysAhead(6) },
    { name: 'Rashmi Chatterjee', phone: '9500123456', email: 'rashmi.c@gmail.com', city: 'Kolkata', state: 'West Bengal', source: 'referral', status: 'converted', priority: 'high', product: 'Options Trading', dealValue: 20000, commission: 2000, latestRemark: 'Second enrollment, very satisfied', callCount: 8, tags: ['repeat-customer', 'converted'] },
    { name: 'Nikhil Garg', phone: '9400123456', email: 'nikhil.garg@gmail.com', city: 'Ludhiana', state: 'Punjab', source: 'google_sheet', status: 'new', priority: 'medium', product: 'Stock Market Course', dealValue: 15000, latestRemark: 'New lead from Google Sheet import', callCount: 0, nextFollowupDate: daysAhead(1) },
    { name: 'Farheen Khan', phone: '9300123456', email: 'farheen.khan@gmail.com', city: 'Hyderabad', state: 'Telangana', source: 'website', status: 'interested', priority: 'high', product: 'Mutual Funds Course', dealValue: 8000, latestRemark: 'Has saved money to invest, very ready', callCount: 4, nextFollowupDate: daysAhead(1), tags: ['hot-lead'] },
    { name: 'Alok Mishra', phone: '9200123456', email: 'alok.mishra@gmail.com', city: 'Kanpur', state: 'Uttar Pradesh', source: 'manual', status: 'contacted', priority: 'medium', product: 'Crypto Masterclass', dealValue: 12000, latestRemark: 'Needs 2 days to decide', callCount: 2, nextFollowupDate: daysAhead(2) },
    { name: 'Sonali Bhosale', phone: '9100123456', email: 'sonali.bhosale@gmail.com', city: 'Pune', state: 'Maharashtra', source: 'social_media', status: 'lost', priority: 'low', product: 'Stock Market Course', dealValue: 0, latestRemark: 'Bought free YouTube course instead', callCount: 2, tags: ['lost'] },
    { name: 'Harish Negi', phone: '9050123456', email: 'harish.negi@gmail.com', city: 'Dehradun', state: 'Uttarakhand', source: 'referral', status: 'new', priority: 'high', product: 'Options Trading', dealValue: 20000, latestRemark: 'CEO of small firm, high budget', callCount: 1, nextFollowupDate: daysAhead(0), tags: ['high-value'] },
    { name: 'Isha Kapoor', phone: '9000123456', email: 'isha.kapoor@gmail.com', city: 'Amritsar', state: 'Punjab', source: 'google_sheet', status: 'nurturing', priority: 'medium', product: 'Mutual Funds Course', dealValue: 8000, latestRemark: 'On maternity leave, will join in 2 months', callCount: 2, nextFollowupDate: daysAhead(30) },
  ];

  await Lead.insertMany(leads.map((l, i) => ({
    ...l,
    createdAt: daysAgo(30 - i),
    updatedAt: daysAgo(Math.floor((30 - i) / 2))
  })));
  console.log(`✅ Seeded ${leads.length} dummy leads`);
};

const connectWithUri = (uri) => mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });

const startInMemoryMongo = async () => {
  const dbPath = path.resolve(__dirname, '../.mongo-data');
  fs.mkdirSync(dbPath, { recursive: true });
  console.log(`Starting embedded MongoDB (local persistent demo mode): ${dbPath}`);
  mongod = await MongoMemoryServer.create({
    instance: {
      dbPath,
      storageEngine: 'wiredTiger'
    }
  });
  return mongod.getUri();
};

const connectDB = async () => {
  try {
    const configuredUri = process.env.MONGO_URI;
    const shouldForceInMemory = process.env.USE_IN_MEMORY_DB === 'true';
    let usingInMemoryMongo = false;
    let conn;

    if (shouldForceInMemory) {
      const memoryUri = await startInMemoryMongo();
      conn = await connectWithUri(memoryUri);
      usingInMemoryMongo = true;
    } else if (configuredUri) {
      try {
        conn = await connectWithUri(configuredUri);
      } catch (error) {
        if (!isProduction && isLocalMongoUri(configuredUri)) {
          console.warn(`Local MongoDB not available (${error.message}). Falling back to in-memory MongoDB.`);
          const memoryUri = await startInMemoryMongo();
          conn = await connectWithUri(memoryUri);
          usingInMemoryMongo = true;
        } else {
          throw error;
        }
      }
    } else if (isProduction) {
      throw new Error('MONGO_URI is required in production. Set a real MongoDB connection string before deploying.');
    } else {
      const memoryUri = await startInMemoryMongo();
      conn = await connectWithUri(memoryUri);
      usingInMemoryMongo = true;
    }

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    const shouldSeedDemoData = process.env.SEED_DEMO_DATA === 'true' || usingInMemoryMongo;
    if (shouldSeedDemoData) {
      await seedAdmin();
      await seedLeads();
    } else {
      console.log('Demo seed skipped');
    }
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
