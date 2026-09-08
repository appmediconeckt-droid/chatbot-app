import axios from '../axiosConfig';
import { Platform } from 'react-native';

/**
 * Validate prescription data before sending
 */
const validatePrescription = (prescription) => {
  const errors = [];
  
  if (!prescription.problem || prescription.problem.trim() === '') {
    errors.push('Problem description is required');
  }
  
  if (!prescription.instructions || prescription.instructions.trim() === '') {
    errors.push('Instructions are required');
  }
  
  if (!Array.isArray(prescription.medicines) || prescription.medicines.length === 0) {
    errors.push('At least one medicine is required');
  } else {
    prescription.medicines.forEach((medicine, index) => {
      if (!medicine.name || medicine.name.trim() === '') {
        errors.push(`Medicine ${index + 1}: name is required`);
      }
      if (!medicine.dosage || medicine.dosage.trim() === '') {
        errors.push(`Medicine ${index + 1}: dosage is required`);
      }
      if (!medicine.duration || medicine.duration.trim() === '') {
        errors.push(`Medicine ${index + 1}: duration is required`);
      }
    });
  }
  
  return { isValid: errors.length === 0, errors };
};

/**
 * Generate a simple PDF prescription as base64
 * This creates a minimal valid PDF that the backend will accept
 */
const generateSimplePDFBase64 = (prescription) => {
  // Create a simple PDF content
  const medicinesText = prescription.medicines
    .map((med, i) => `${i + 1}. ${med.name} - ${med.dosage} - ${med.duration}`)
    .join('\n');
  
  const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/Resources 4 0 R/MediaBox[0 0 612 792]/Contents 5 0 R>>endobj
4 0 obj<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>endobj
5 0 obj<</Length 800>>stream
BT
/F1 12 Tf
50 750 Td
(PRESCRIPTION) Tj
0 -30 Td
(Problem: ${prescription.problem.substring(0, 50)}) Tj
0 -20 Td
(Instructions: ${prescription.instructions.substring(0, 50)}) Tj
0 -20 Td
(Medicines:) Tj
0 -15 Td
(${medicinesText.substring(0, 100)}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000203 00000 n 
0000000295 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
1145
%%EOF`;

  // Convert to base64
  let base64 = '';
  try {
    base64 = btoa(pdfContent);
  } catch (e) {
    // For React Native, use a different approach
    base64 = Buffer.from(pdfContent).toString('base64');
  }
  
  return base64;
};

/**
 * Create a Blob from base64 PDF data
 */
const base64ToBlob = (base64Data) => {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'application/pdf' });
  } catch (e) {
    console.error('Error converting base64 to Blob:', e);
    // Return empty blob as fallback
    return new Blob([], { type: 'application/pdf' });
  }
};

/**
 * Create a new prescription for a chat session
 * @param {string} chatId - The chat session ID
 * @param {Object} prescription - Prescription data
 * @param {string} prescription.problem - Medical problem description
 * @param {string} prescription.instructions - Doctor's instructions
 * @param {Array<Object>} prescription.medicines - List of medicines
 * @param {string|Object} prescription.pdfFile - Optional PDF file URI
 * @returns {Promise} API response with prescription data
 */
const createPrescription = async (chatId, prescription) => {
  // Validate input
  const validation = validatePrescription(prescription);
  if (!validation.isValid) {
    const errorMsg = validation.errors.join('\n');
    console.error('❌ Validation failed:\n' + errorMsg);
    throw new Error('Validation failed:\n' + errorMsg);
  }
  
  const url = `/api/prescriptions/chat/${chatId}`;
  console.log('🔵 Creating prescription with multipart/form-data...');
  console.log('📤 URL:', url);
  
  // Create FormData
  const formData = new FormData();
  
  // Add text fields
  formData.append('problem', prescription.problem.trim());
  formData.append('instructions', prescription.instructions.trim());
  
  // Add medicines as JSON string
  const medicinesData = prescription.medicines.map(med => ({
    name: med.name.trim(),
    dosage: med.dosage.trim(),
    timeOfDay: med.timeOfDay || [],
    timing: med.timing?.trim() || '',
    duration: med.duration.trim(),
  }));
  formData.append('medicines', JSON.stringify(medicinesData));
  
  // Generate PDF as base64
  let pdfBase64 = null;
  if (!prescription.pdfFile) {
    console.log('⚠️  No PDF provided, generating default...');
    try {
      pdfBase64 = generateSimplePDFBase64(prescription);
      console.log('✅ PDF generated, length:', pdfBase64.length);
    } catch (err) {
      console.error('❌ Failed to generate PDF:', err);
      throw new Error('Failed to generate PDF: ' + err.message);
    }
  }
  
  // Add PDF as base64 to FormData
  if (pdfBase64) {
    console.log('📎 Adding PDF as base64 to form data');
    formData.append('pdfFile', pdfBase64);
  } else if (typeof prescription.pdfFile === 'string') {
    // If it's a URI path, append it as is
    console.log('📎 Adding PDF from URI');
    formData.append('pdfFile', prescription.pdfFile);
  }
  
  console.log('📦 Sending multipart form data with PDF...');
  
  try {
    const response = await axios({
      method: 'post',
      url: url,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('✅ Prescription created successfully!');
    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
    return response;
  } catch (error) {
    console.error('❌ Error creating prescription');
    console.error('  URL:', url);
    console.error('  FormData fields:', {
      problem: prescription.problem.substring(0, 20),
      instructions: prescription.instructions.substring(0, 20),
      medicines: medicinesData.length,
      pdfSize: pdfBase64?.length || 'none',
    });
    console.error('  Status:', error.response?.status);
    console.error('  Backend error:', error.response?.data?.error || error.response?.data?.message || error.response?.data);
    console.error('  Message:', error.message);
    throw error;
  }
};

/**
 * Get prescription details by ID
 * @param {string} prescriptionId - The prescription ID
 * @returns {Promise} API response with prescription data
 */
const getPrescription = async (prescriptionId) => {
  return axios.get(`/api/prescriptions/${prescriptionId}`);
};

/**
 * Get all prescriptions for a chat
 * @param {string} chatId - The chat session ID
 * @returns {Promise} API response with list of prescriptions
 */
const getChatPrescriptions = async (chatId) => {
  return axios.get(`/api/prescriptions/chat/${chatId}`);
};

/**
 * Update a prescription
 * @param {string} prescriptionId - The prescription ID
 * @param {Object} updates - Updated prescription data
 * @returns {Promise} API response with updated prescription
 */
const updatePrescription = async (prescriptionId, updates) => {
  return axios.put(`/api/prescriptions/${prescriptionId}`, updates);
};

/**
 * Delete a prescription
 * @param {string} prescriptionId - The prescription ID
 * @returns {Promise} API response confirming deletion
 */
const deletePrescription = async (prescriptionId) => {
  return axios.delete(`/api/prescriptions/${prescriptionId}`);
};

/**
 * Create prescription using direct fetch with multipart form data
 */
const createPrescriptionWithFetch = async (chatId, prescription) => {
  const validation = validatePrescription(prescription);
  if (!validation.isValid) {
    throw new Error('Validation failed: ' + validation.errors.join(', '));
  }

  const formData = new FormData();
  formData.append('problem', prescription.problem.trim());
  formData.append('instructions', prescription.instructions.trim());
  
  const medicinesData = prescription.medicines.map(med => ({
    name: med.name.trim(),
    dosage: med.dosage.trim(),
    timeOfDay: med.timeOfDay || [],
    timing: med.timing?.trim() || '',
    duration: med.duration.trim(),
  }));
  formData.append('medicines', JSON.stringify(medicinesData));

  // Generate PDF as base64 if not provided
  let pdfBase64 = null;
  if (!prescription.pdfFile) {
    console.log('⚠️  Generating PDF for fetch method...');
    try {
      pdfBase64 = generateSimplePDFBase64(prescription);
      console.log('✅ PDF generated, length:', pdfBase64.length);
    } catch (err) {
      console.error('❌ Failed to generate PDF:', err);
      throw new Error('Failed to generate PDF: ' + err.message);
    }
  }

  // Add PDF to form data
  if (pdfBase64) {
    formData.append('pdfFile', pdfBase64);
  } else if (typeof prescription.pdfFile === 'string') {
    formData.append('pdfFile', prescription.pdfFile);
  }

  const url = `https://s5jl7g4z-5001.inc1.devtunnels.ms/api/prescriptions/chat/${chatId}`;
  
  console.log('🔵 Using FETCH method with multipart...');
  console.log('📤 Full URL:', url);

  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const token = await AsyncStorage.getItem('accessToken') || await AsyncStorage.getItem('token');
    
    const headers = {
      'X-Tunnel-Skip-AntiPhishing-Page': 'true',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ Fetch error:', response.status);
      throw new Error(`API Error: ${response.status} - ${responseData?.error || responseData?.message || 'Unknown error'}`);
    }

    console.log('✅ Prescription created with FETCH!');
    console.log('✅ Response:', JSON.stringify(responseData, null, 2));
    return { data: responseData, status: response.status };
  } catch (error) {
    console.error('❌ Fetch error:', error.message);
    throw error;
  }
};

/**
 * Create prescription with manual multipart encoding
 * Best compatibility for React Native
 */
const createPrescriptionRawMultipart = async (chatId, prescription) => {
  const validation = validatePrescription(prescription);
  if (!validation.isValid) {
    throw new Error('Validation failed: ' + validation.errors.join(', '));
  }

  // Generate PDF
  let pdfBase64 = prescription.pdfFile;
  if (!pdfBase64) {
    console.log('⚠️  Generating PDF...');
    pdfBase64 = generateSimplePDFBase64(prescription);
  }

  // Decode base64 to binary
  let pdfBinary;
  try {
    const binaryString = atob(pdfBase64);
    pdfBinary = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pdfBinary[i] = binaryString.charCodeAt(i);
    }
  } catch (err) {
    console.error('❌ Failed to convert PDF:', err);
    throw err;
  }

  const boundary = '----FormBoundary' + Date.now();
  const CRLF = '\r\n';
  
  // Build multipart body
  let body = '';
  
  // Add problem field
  body += '--' + boundary + CRLF;
  body += 'Content-Disposition: form-data; name="problem"' + CRLF + CRLF;
  body += prescription.problem.trim() + CRLF;
  
  // Add instructions field
  body += '--' + boundary + CRLF;
  body += 'Content-Disposition: form-data; name="instructions"' + CRLF + CRLF;
  body += prescription.instructions.trim() + CRLF;
  
  // Add medicines field
  const medicinesData = prescription.medicines.map(med => ({
    name: med.name.trim(),
    dosage: med.dosage.trim(),
    timeOfDay: med.timeOfDay || [],
    timing: med.timing?.trim() || '',
    duration: med.duration.trim(),
  }));
  body += '--' + boundary + CRLF;
  body += 'Content-Disposition: form-data; name="medicines"' + CRLF + CRLF;
  body += JSON.stringify(medicinesData) + CRLF;
  
  // Add PDF file
  body += '--' + boundary + CRLF;
  body += 'Content-Disposition: form-data; name="pdfFile"; filename="prescription.pdf"' + CRLF;
  body += 'Content-Type: application/pdf' + CRLF + CRLF;
  
  // Convert body to Uint8Array and append binary PDF data
  const bodyUint8 = new Uint8Array(new TextEncoder().encode(body));
  const boundary_end = new Uint8Array(new TextEncoder().encode(CRLF + '--' + boundary + '--' + CRLF));
  
  // Combine all parts
  const combined = new Uint8Array(bodyUint8.length + pdfBinary.length + boundary_end.length);
  combined.set(bodyUint8);
  combined.set(pdfBinary, bodyUint8.length);
  combined.set(boundary_end, bodyUint8.length + pdfBinary.length);

  const url = `https://s5jl7g4z-5001.inc1.devtunnels.ms/api/prescriptions/chat/${chatId}`;
  
  console.log('🔵 Using raw multipart encoding...');
  console.log('📤 Full URL:', url);
  console.log('📦 Total payload size:', combined.length, 'bytes');

  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const token = await AsyncStorage.getItem('accessToken') || await AsyncStorage.getItem('token');
    
    const headers = {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'X-Tunnel-Skip-AntiPhishing-Page': 'true',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: combined,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ Raw multipart error:', response.status);
      throw new Error(`API Error: ${response.status} - ${responseData?.error || responseData?.message || 'Unknown error'}`);
    }

    console.log('✅ Prescription created with raw multipart!');
    console.log('✅ Response:', JSON.stringify(responseData, null, 2));
    return { data: responseData, status: response.status };
  } catch (error) {
    console.error('❌ Raw multipart error:', error.message);
    throw error;
  }
};

export default {
  createPrescription,
  createPrescriptionWithFetch,
  createPrescriptionRawMultipart,
  getPrescription,
  getChatPrescriptions,
  updatePrescription,
  deletePrescription,
};
