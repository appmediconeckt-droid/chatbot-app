import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import prescriptionService from '../services/prescriptionService';

export default function PrescriptionTest() {
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const testData = {
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

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await prescriptionService.createPrescription(
        'chat_1788153410928_qtmowc5hz',
        testData
      );
      setResponse(result.data);
      console.log('✅ Success:', result.data);
    } catch (err) {
      const errorDetails = {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      };
      setError(errorDetails);
      console.error('❌ Error:', errorDetails);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
        Prescription Test
      </Text>

      <TouchableOpacity
        onPress={handleTest}
        disabled={loading}
        style={{
          backgroundColor: loading ? '#ccc' : '#007AFF',
          padding: 12,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
          {loading ? 'Testing...' : 'Test Send Prescription'}
        </Text>
      </TouchableOpacity>

      {error && (
        <View style={{ backgroundColor: '#fee', padding: 12, borderRadius: 8, marginBottom: 20 }}>
          <Text style={{ color: '#c00', fontWeight: 'bold' }}>Error:</Text>
          <Text style={{ color: '#c00', marginTop: 5 }}>{error.message}</Text>
          {error.status && (
            <Text style={{ color: '#c00', marginTop: 5 }}>Status: {error.status}</Text>
          )}
          {error.data && (
            <Text style={{ color: '#c00', marginTop: 5, fontSize: 12 }}>
              {JSON.stringify(error.data, null, 2)}
            </Text>
          )}
        </View>
      )}

      {response && (
        <View style={{ backgroundColor: '#efe', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: '#060, fontWeight: 'bold' }}>Success!</Text>
          <Text style={{ color: '#060', marginTop: 5, fontSize: 12 }}>
            {JSON.stringify(response, null, 2)}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
