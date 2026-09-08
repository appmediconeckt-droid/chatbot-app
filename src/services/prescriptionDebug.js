import axios from '../axiosConfig';

/**
 * TEST FUNCTION - Debug prescription sending
 * Run this to see exactly what's being sent
 */
export const testPrescriptionPayload = async () => {
  const chatId = 'chat_1788153410928_qtmowc5hz';
  const testPayload = {
    problem: 'gfdsgfd',
    instructions: 'hjfhsjhfdkjsfdjhfdsfdnbvfn hdfvhjfdshjvjfvbfd vnsnmnfsf',
    medicines: [
      {
        name: 'peractamol',
        dosage: '500mg',
        timeOfDay: ['Morning', 'Evening'],
        timing: 'lunch and dinner after',
        duration: '4 days',
      },
    ],
  };

  console.log('========== PRESCRIPTION TEST ==========');
  console.log('📤 Sending to:', `https://s5jl7g4z-5001.inc1.devtunnels.ms/api/prescriptions/chat/${chatId}`);
  console.log('📦 Payload:', JSON.stringify(testPayload, null, 2));
  console.log('========================================\n');

  try {
    // Test 1: Direct fetch to bypass axios interceptors
    console.log('🔵 Test 1: Using native fetch...');
    const fetchResponse = await fetch(
      `https://s5jl7g4z-5001.inc1.devtunnels.ms/api/prescriptions/chat/${chatId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tunnel-Skip-AntiPhishing-Page': 'true',
        },
        body: JSON.stringify(testPayload),
      }
    );
    console.log('✅ Fetch Status:', fetchResponse.status);
    const fetchData = await fetchResponse.json();
    console.log('✅ Fetch Response:', JSON.stringify(fetchData, null, 2));
  } catch (error) {
    console.error('❌ Fetch Error:', error.message);
  }

  console.log('\n');

  try {
    // Test 2: Using axios
    console.log('🔵 Test 2: Using axios...');
    const axiosResponse = await axios.post(
      `/api/prescriptions/chat/${chatId}`,
      testPayload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✅ Axios Status:', axiosResponse.status);
    console.log('✅ Axios Response:', JSON.stringify(axiosResponse.data, null, 2));
  } catch (error) {
    console.error('❌ Axios Error:', error.message);
    console.error('   Status:', error.response?.status);
    console.error('   Response:', JSON.stringify(error.response?.data, null, 2));
  }
};
