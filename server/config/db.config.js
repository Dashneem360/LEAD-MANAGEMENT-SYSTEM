const sequelize = require('./sequelize');

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL Connected');

    require('../models/index');

    const alter = process.env.NODE_ENV !== 'production';
    await sequelize.sync({ alter });
    console.log(`Database synced (alter: ${alter})`);

    if (process.env.SEED_DEMO_DATA !== 'false') {
      await seedAdmin();
      await seedLeads();
    } else {
      console.log('Demo seed skipped');
    }
  } catch (err) {
    console.error(`PostgreSQL Connection Error: ${err.message}`);
    process.exit(1);
  }
};

const seedAdmin = async () => {
  const { User } = require('../models');
  const existing = await User.findOne({ where: { email: 'admin@dashneem.com' } });
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
  const { Lead } = require('../models');
  const count = await Lead.count();
  if (count > 0) return;

  const today = new Date();
  const daysAgo = (n) => new Date(today - n * 86400000);
  const daysAhead = (n) => new Date(today.getTime() + n * 86400000);

  const leads = [
    { name: 'Rahul Sharma', phone: '9876543210', email: 'rahul.sharma@gmail.com', city: 'Mumbai', state: 'Maharashtra', source: 'website', status: 'new', priority: 'high', product: 'Stock Market Course', dealValue: 15000, latestRemark: 'Very interested, called twice', callCount: 2, nextFollowupDate: daysAhead(1), tags: ['hot-lead'] },
    { name: 'Priya Patel', phone: '9123456780', email: 'priya.patel@yahoo.com', city: 'Ahmedabad', state: 'Gujarat', source: 'referral', status: 'contacted', priority: 'high', product: 'Options Trading', dealValue: 20000, latestRemark: 'Asked for demo', callCount: 3, nextFollowupDate: daysAhead(1), tags: ['demo-scheduled'] },
    { name: 'Amit Verma', phone: '9988776655', email: 'amit.verma@outlook.com', city: 'Delhi', state: 'Delhi', source: 'social_media', status: 'interested', priority: 'high', product: 'Crypto Masterclass', dealValue: 12000, latestRemark: 'Ready to pay', callCount: 5, nextFollowupDate: daysAhead(0), tags: ['hot-lead'] },
    { name: 'Sunita Rao', phone: '8765432109', email: 'sunita.rao@gmail.com', city: 'Bangalore', state: 'Karnataka', source: 'google_sheet', status: 'nurturing', priority: 'medium', product: 'Mutual Funds Course', dealValue: 8000, latestRemark: 'Will decide after salary', callCount: 4, nextFollowupDate: daysAhead(3) },
    { name: 'Vikram Singh', phone: '7654321098', email: 'vikram.singh@gmail.com', city: 'Jaipur', state: 'Rajasthan', source: 'manual', status: 'converted', priority: 'high', product: 'Stock Market Course', dealValue: 15000, commission: 1500, latestRemark: 'Payment received', callCount: 6, tags: ['converted'] },
    { name: 'Neha Gupta', phone: '6543210987', email: 'neha.gupta@gmail.com', city: 'Lucknow', state: 'Uttar Pradesh', source: 'website', status: 'not_interested', priority: 'low', product: 'Options Trading', dealValue: 0, latestRemark: 'Too expensive', callCount: 2, tags: ['cold'] },
    { name: 'Rajesh Kumar', phone: '9871234560', email: 'rajesh.kumar@rediffmail.com', city: 'Patna', state: 'Bihar', source: 'referral', status: 'new', priority: 'medium', product: 'Crypto Masterclass', dealValue: 12000, latestRemark: 'Referred by Vikram', callCount: 1, nextFollowupDate: daysAhead(2) },
    { name: 'Meera Nair', phone: '9562345670', email: 'meera.nair@gmail.com', city: 'Kochi', state: 'Kerala', source: 'social_media', status: 'contacted', priority: 'medium', product: 'Mutual Funds Course', dealValue: 8000, latestRemark: 'Wants more info', callCount: 2, nextFollowupDate: daysAhead(1) },
    { name: 'Suresh Reddy', phone: '9345678901', email: 'suresh.reddy@gmail.com', city: 'Hyderabad', state: 'Telangana', source: 'website', status: 'interested', priority: 'high', product: 'Stock Market Course', dealValue: 15000, latestRemark: 'Wants payment plan', callCount: 4, nextFollowupDate: daysAhead(0), tags: ['payment-plan'] },
    { name: 'Anjali Mehta', phone: '9234567891', email: 'anjali.mehta@gmail.com', city: 'Surat', state: 'Gujarat', source: 'google_sheet', status: 'converted', priority: 'high', product: 'Options Trading', dealValue: 20000, commission: 2000, latestRemark: 'Enrolled and paid', callCount: 7, tags: ['converted'] }
  ];

  await Lead.bulkCreate(leads.map((l, i) => ({
    ...l,
    createdAt: daysAgo(10 - i),
    updatedAt: daysAgo(5 - Math.floor(i / 2))
  })));
  console.log(`✅ Seeded ${leads.length} demo leads`);
};

module.exports = connectDB;
