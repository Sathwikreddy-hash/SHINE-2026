import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldCheck, XCircle } from 'lucide-react';

export default function Landing() {
  const [showGate, setShowGate] = useState(true);
  const [isNotStudent, setIsNotStudent] = useState(false);
  const navigate = useNavigate();

  if (isNotStudent) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md"
        >
          <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 text-lg">
            This platform is exclusively for Shine High students.
          </p>
          <button 
            onClick={() => setIsNotStudent(false)}
            className="mt-8 text-blue-600 font-medium hover:underline"
          >
            Go Back
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full -mr-48 -mt-48 blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100 rounded-full -ml-48 -mb-48 blur-3xl opacity-50" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 text-center max-w-2xl"
      >
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
        </div>
        
        <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">
          Welcome to <span className="text-blue-600">ShineHub</span>
        </h1>
        <p className="text-xl text-gray-500 mb-12 font-light">
          Are you from Shine High School?
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/register')}
            className="px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-all hover:shadow-lg hover:shadow-blue-200 active:scale-95"
          >
            Yes, I'm a Student
          </button>
          <button
            onClick={() => setIsNotStudent(true)}
            className="px-8 py-4 bg-white text-gray-400 border border-gray-200 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-all active:scale-95"
          >
            No
          </button>
        </div>

        <div className="mt-12 text-gray-400 text-sm">
          Private • Secure • Exclusive
        </div>
      </motion.div>
    </div>
  );
}
