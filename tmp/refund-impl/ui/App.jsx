import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './styles/toast.css'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Counselors from './pages/Counselors'
import Settings from './pages/Settings'
import RevenueDashboard from './pages/RevenueDashboard'
import CounselorRevenue from './pages/CounselorRevenue'
import PayoutManagement from './pages/PayoutManagement'
import AuditLogs from './pages/AuditLogs'
import AdminSettings from './pages/AdminSettings'
import LocationHistory from './pages/LocationHistory'
import Reviews from './pages/Reviews'
import WalletPayments from './pages/WalletPayments'
import SupportInbox from './pages/SupportInbox'
import RefundManagement from './pages/RefundManagement'
import './App.css'

function App() {
  return (
    <Router>
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
        <Route path="/counselors" element={<ProtectedRoute><Counselors /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/revenue" element={<ProtectedRoute><RevenueDashboard /></ProtectedRoute>} />
        <Route path="/counselor-revenue" element={<ProtectedRoute><CounselorRevenue /></ProtectedRoute>} />
        <Route path="/payouts" element={<ProtectedRoute><PayoutManagement /></ProtectedRoute>} />
        <Route path="/wallet-payments" element={<ProtectedRoute><WalletPayments /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><SupportInbox /></ProtectedRoute>} />
        <Route path="/refunds" element={<ProtectedRoute><RefundManagement /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
        <Route path="/admin-settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
        <Route path="/location-history" element={<ProtectedRoute><LocationHistory /></ProtectedRoute>} />
        <Route path="/reviews" element={<ProtectedRoute><Reviews /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  )
}

export default App
