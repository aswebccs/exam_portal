import React, { useState } from 'react';
import Category from './Category';
import Subcategory from './Subcategory';
import Exam from './Exam';
import Questions from './Questions';

/**
 * ExamManagement.jsx - Main Container
 * 
 * Manages navigation between 4 steps:
 * 1. Category
 * 2. Subcategory
 * 3. Exam
 * 4. Questions
 * 
 * Uses simple step-based navigation (no complex wizard component)
 */

const ExamManagement = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Category
    categoryId: null,
    categoryName: '',
    
    // Step 2: Subcategory
    subcategoryId: null,
    subcategoryName: '',
    
    // Step 3: Exam
    examId: null,
    examTitle: '',
    levelName: '',
  });

  // Step 1 → Step 2
  const handleCategoryNext = (categoryData) => {
    setFormData({ ...formData, ...categoryData });
    setCurrentStep(2);
  };

  // Step 2 → Step 3
  const handleSubcategoryNext = (subcategoryData) => {
    setFormData({ ...formData, ...subcategoryData });
    setCurrentStep(3);
  };

  // Step 4 → Step 5
  const handleExamNext = (examData) => {
    setFormData({ ...formData, ...examData });
    setCurrentStep(4);
  };

  // Step 5 → Complete
  const handleQuestionsComplete = (result) => {
    console.log('Exam created successfully:', result);
    
    // Reset to step 1 or navigate to exam list
    if (onComplete) {
      onComplete(result);
    } else {
      // Default: Reset to category selection
      setCurrentStep(1);
      setFormData({
        categoryId: null,
        categoryName: '',
        subcategoryId: null,
        subcategoryName: '',
        examId: null,
        examTitle: '',
        levelName: '',
      });
    }
  };

  // Back navigation handlers
  const handleBackToCategory = () => setCurrentStep(1);
  const handleBackToSubcategory = () => setCurrentStep(2);
  const handleBackToExam = () => setCurrentStep(3);

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Category onNext={handleCategoryNext} />;
      
      case 2:
        return (
          <Subcategory
            categoryId={formData.categoryId}
            categoryName={formData.categoryName}
            onNext={handleSubcategoryNext}
            onBack={handleBackToCategory}
          />
        );
      
      
      case 3:
        return (
          <Exam
            categoryId={formData.categoryId}
            categoryName={formData.categoryName}
            subcategoryId={formData.subcategoryId}
            subcategoryName={formData.subcategoryName}
            onNext={handleExamNext}
            onBack={handleBackToSubcategory}
          />
        );
      
      case 4:
        return (
          <Questions
            categoryName={formData.categoryName}
            subcategoryName={formData.subcategoryName}
            examId={formData.examId}
            examTitle={formData.examTitle}
            levelName={formData.levelName}
            onComplete={handleQuestionsComplete}
            onBack={handleBackToExam}
          />
        );
      
      default:
        return <Category onNext={handleCategoryNext} />;
    }
  };

  return (
    <div className="exam-management-container">
      {renderStep()}
    </div>
  );
};

export default ExamManagement;
