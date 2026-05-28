const { google } = require('googleapis');
const Lead = require('../models/Lead');

const getAuthClient = () => {
  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  };

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Google Sheets credentials not configured. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in .env');
  }

  return new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  );
};

const getSheetData = async (sheetId) => {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetIdToUse = sheetId || process.env.GOOGLE_SHEET_ID;

  if (!sheetIdToUse) throw new Error('No Google Sheet ID provided');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetIdToUse,
    range: 'Sheet1!A1:Z1000'
  });

  return response.data.values || [];
};

// Map sheet row to lead object
// Expected columns: Name, Phone, Alternate Phone, Email, City, State, Product, Source, Notes
const mapRowToLead = (headers, row) => {
  const obj = {};
  headers.forEach((header, i) => {
    obj[header.toLowerCase().replace(/\s+/g, '_')] = row[i] || '';
  });

  return {
    name: obj.name || obj.full_name || '',
    phone: obj.phone || obj.mobile || obj.phone_number || '',
    alternatePhone: obj.alternate_phone || obj.alt_phone || '',
    email: obj.email || obj.email_id || '',
    city: obj.city || '',
    state: obj.state || '',
    product: obj.product || obj.course || obj.service || '',
    notes: obj.notes || obj.remarks || obj.comment || ''
  };
};

exports.syncGoogleSheet = async (sheetId) => {
  const rows = await getSheetData(sheetId);
  if (rows.length < 2) return { created: 0, updated: 0, skipped: 0 };

  const headers = rows[0];
  const dataRows = rows.slice(1);
  let created = 0, updated = 0, skipped = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const leadData = mapRowToLead(headers, row);
    if (!leadData.phone || !leadData.name) { skipped++; continue; }

    try {
      const existing = await Lead.findOne({ phone: leadData.phone });
      if (existing) {
        // Only update non-status fields from sheet
        existing.name = leadData.name || existing.name;
        existing.alternatePhone = leadData.alternatePhone || existing.alternatePhone;
        existing.email = leadData.email || existing.email;
        existing.city = leadData.city || existing.city;
        existing.state = leadData.state || existing.state;
        existing.product = leadData.product || existing.product;
        existing.lastSyncedAt = new Date();
        existing.sheetRowIndex = i + 2;
        existing.sheetId = sheetId || process.env.GOOGLE_SHEET_ID;
        await existing.save();
        updated++;
      } else {
        await Lead.create({
          ...leadData,
          source: 'google_sheet',
          lastSyncedAt: new Date(),
          sheetRowIndex: i + 2,
          sheetId: sheetId || process.env.GOOGLE_SHEET_ID
        });
        created++;
      }
    } catch (err) {
      console.error(`Row ${i + 2} error: ${err.message}`);
      skipped++;
    }
  }

  console.log(`Sheet sync: ${created} created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
};

exports.importFromRows = async (headers, rows) => {
  let created = 0, updated = 0, skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const leadData = mapRowToLead(headers, rows[i]);
    if (!leadData.phone || !leadData.name) { skipped++; continue; }
    try {
      const existing = await Lead.findOne({ phone: leadData.phone });
      if (existing) {
        Object.assign(existing, {
          name: leadData.name || existing.name,
          alternatePhone: leadData.alternatePhone || existing.alternatePhone,
          email: leadData.email || existing.email,
          city: leadData.city || existing.city,
          state: leadData.state || existing.state,
          product: leadData.product || existing.product,
          lastSyncedAt: new Date()
        });
        await existing.save();
        updated++;
      } else {
        await Lead.create({ ...leadData, source: 'google_sheet', lastSyncedAt: new Date() });
        created++;
      }
    } catch (err) {
      skipped++;
    }
  }
  return { created, updated, skipped };
};

exports.getSheetPreview = async (sheetId) => {
  const rows = await getSheetData(sheetId);
  if (rows.length === 0) return { headers: [], rows: [] };
  return {
    headers: rows[0],
    rows: rows.slice(1, 11), // Preview first 10 rows
    totalRows: rows.length - 1
  };
};
