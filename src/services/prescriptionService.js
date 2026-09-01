import axios from '../axiosConfig';

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
 * Create a new prescription for a chat session
 * @param {string} chatId - The chat session ID
 * @param {Object} prescription - Prescription data
 * @param {string} prescription.problem - Medical problem description
 * @param {string} prescription.instructions - Doctor's instructions
 * @param {Array<Object>} prescription.medicines - List of medicines
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
  
  const payload = {
    problem: prescription.problem.trim(),
    instructions: prescription.instructions.trim(),
    medicines: prescription.medicines.map(med => ({
      name: med.name.trim(),
      dosage: med.dosage.trim(),
      timeOfDay: med.timeOfDay || [],
      timing: med.timing?.trim() || '',
      duration: med.duration.trim(),
    })),
  };
  
  console.log('🔵 Creating prescription with payload:', JSON.stringify(payload, null, 2));
  console.log('🔵 Target URL:', `/api/prescriptions/chat/${chatId}`);
  
  try {
    const response = await axios.post(`/api/prescriptions/chat/${chatId}`, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('✅ Prescription created successfully:', response.data);
    return response;
  } catch (error) {
    console.error('❌ Error creating prescription:');
    console.error('  Status:', error.response?.status);
    console.error('  Message:', error.response?.data?.message || error.message);
    console.error('  Full Error:', error.response?.data);
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

export default {
  createPrescription,
  getPrescription,
  getChatPrescriptions,
  updatePrescription,
  deletePrescription,
};
