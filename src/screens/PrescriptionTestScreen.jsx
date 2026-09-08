import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import prescriptionService from '../services/prescriptionService';

export default function PrescriptionTestScreen() {
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('');

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

  const handleTestAxios = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setMethod('axios');

    try {
      console.log('🔵 Testing AXIOS...');
      const result = await prescriptionService.createPrescription(
        'chat_1788153410928_qtmowc5hz',
        testData
      );
      setResponse(result.data);
      console.log('✅ Axios Success:', result.data);
    } catch (err) {
      const errorDetails = {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      };
      setError(errorDetails);
      console.error('❌ Axios Error:', errorDetails);
    } finally {
      setLoading(false);
    }
  };

  const handleTestFetch = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setMethod('fetch');

    try {
      console.log('🔵 Testing FETCH...');
      const result = await prescriptionService.createPrescriptionWithFetch(
        'chat_1788153410928_qtmowc5hz',
        testData
      );
      setResponse(result.data);
      console.log('✅ Fetch Success:', result.data);
    } catch (err) {
      setError({
        message: err.message,
      });
      console.error('❌ Fetch Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestRawMultipart = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setMethod('raw-multipart');

    try {
      console.log('🔵 Testing RAW MULTIPART...');
      const result = await prescriptionService.createPrescriptionRawMultipart(
        'chat_1788153410928_qtmowc5hz',
        testData
      );
      setResponse(result.data);
      console.log('✅ Raw Multipart Success:', result.data);
    } catch (err) {
      setError({
        message: err.message,
      });
      console.error('❌ Raw Multipart Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 5 }}>
        📋 Prescription API Test
      </Text>
      
      <Text style={{ fontSize: 12, color: '#666', marginBottom: 20 }}>
        Test different methods to upload prescription with PDF
      </Text>

      <TouchableOpacity
        onPress={handleTestAxios}
        disabled={loading}
        style={{
          backgroundColor: loading && method === 'axios' ? '#ccc' : '#007AFF',
          padding: 12,
          borderRadius: 8,
          marginBottom: 10,
        }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
          {loading && method === 'axios' ? 'Testing Axios...' : '1. Test Axios (FormData)'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleTestFetch}
        disabled={loading}
        style={{
          backgroundColor: loading && method === 'fetch' ? '#ccc' : '#28a745',
          padding: 12,
          borderRadius: 8,
          marginBottom: 10,
        }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
          {loading && method === 'fetch' ? 'Testing Fetch...' : '2. Test Fetch (FormData)'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleTestRawMultipart}
        disabled={loading}
        style={{
          backgroundColor: loading && method === 'raw-multipart' ? '#ccc' : '#dc3545',
          padding: 12,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
          {loading && method === 'raw-multipart' ? 'Testing Raw Multipart...' : '3. Test Raw Multipart (BEST)'}
        </Text>
      </TouchableOpacity>

      {error && (
        <View style={{ backgroundColor: '#fee', padding: 12, borderRadius: 8, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#c00' }}>
          <Text style={{ color: '#c00', fontWeight: 'bold' }}>❌ {method?.toUpperCase()} Error:</Text>
          <Text style={{ color: '#c00', marginTop: 5, fontSize: 12 }}>{error.message}</Text>
          {error.status && (
            <Text style={{ color: '#c00', marginTop: 5, fontSize: 11 }}>Status: {error.status}</Text>
          )}
          {error.data && (
            <Text style={{ color: '#c00', marginTop: 5, fontSize: 10 }}>
              {JSON.stringify(error.data, null, 2)}
            </Text>
          )}
        </View>
      )}

      {response && (
        <View style={{ backgroundColor: '#efe', padding: 12, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#060' }}>
          <Text style={{ color: '#060', fontWeight: 'bold' }}>✅ {method?.toUpperCase()} Success!</Text>
          <Text style={{ color: '#060', marginTop: 5, fontSize: 11 }}>
            {JSON.stringify(response, null, 2)}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
