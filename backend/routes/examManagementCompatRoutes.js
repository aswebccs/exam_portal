const express = require("express");
const controller = require("../controllers/examManagementCompatController");

const router = express.Router();

router.get("/categories", controller.getCategories);
router.get("/subcategories", controller.getSubcategories);
router.get("/levels", controller.getLevels);
router.get("/exam-types", controller.getExamTypes);
router.get("/question-types", controller.getQuestionTypes);
router.patch("/question-types/:id/toggle", controller.toggleQuestionType);

router.post("/exams/badge/upload", controller.uploadBadge);
router.get("/exams", controller.listExams);
router.post("/exams", controller.createExam);
router.get("/exams/:id", controller.getExamById);
router.put("/exams/:id", controller.updateExam);
router.delete("/exams/:id", controller.deleteExam);
router.patch("/exams/:id/toggle", controller.toggleExam);
router.patch("/exams/:id/toggle-result-visibility", controller.toggleExamResultVisibility);

router.get("/exams/:examId/modules", controller.getExamModules);
router.post("/exams/:examId/modules", controller.createExamModules);
router.get("/exams/:examId/questions", controller.getExamQuestions);
router.post("/exams/:examId/questions", controller.createExamQuestions);
router.put("/exams/:examId/questions/:questionId", controller.updateExamQuestion);
router.delete("/exams/:examId/questions/:questionId", controller.deleteExamQuestion);

router.get("/attempts", controller.getAttempts);

router.get("/categories/trash/list", controller.listTrashCategories);
router.get("/subcategories/trash/list", controller.listTrashSubcategories);
router.get("/exams/trash/list", controller.listTrashExams);
router.get("/questions/trash/list", controller.listTrashQuestions);

router.patch("/categories/:id/restore", controller.restoreCategory);
router.patch("/subcategories/:id/restore", controller.restoreSubcategory);
router.patch("/exams/:id/restore", controller.restoreExam);
router.patch("/questions/:id/restore", controller.restoreQuestion);

router.delete("/categories/:id/permanent", controller.permanentDeleteCategory);
router.delete("/subcategories/:id/permanent", controller.permanentDeleteSubcategory);
router.delete("/exams/:id/permanent", controller.permanentDeleteExam);
router.delete("/questions/:id/permanent", controller.permanentDeleteQuestion);

module.exports = router;
