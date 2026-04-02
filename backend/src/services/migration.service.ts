import { DatabaseService } from './database.service.js';
import {
    CareerModel,
    CourseTypeModel,
    EvaluationModel,
    FacultyModel,
    MatriculatedSubjectModel,
    StudentModel,
    StudentStatusModel,
    SubjectModel,
    EvaluationValueModel,
    ExaminationTypeModel
} from '../models/sigenu/index.js'

export const MigrationService = {
    async migrateAll() {
        console.log('Starting massive migration from SIGENU...');

        try {
            await this.migrateFaculties();
            await this.migrateCourseTypes();
            await this.migrateStudentStatuses();
            await this.migrateEvaluationValues();
            await this.migrateExaminationTypes();

            await this.migrateCareers();
            await this.migrateStudents();
            await this.migrateSubjects();
            await this.migrateMatriculatedSubjects();

            await this.migrateEvaluations();

            console.log('Migration completed successfully.');
        } catch (error: any) {
            console.error('Critical error during migration process:', error.message);
            throw error;
        }
    },

    async migrateFaculties() {
        console.log('Migrating Faculties...');

        const rows = await DatabaseService.getRows(`
        SELECT DISTINCT f.id_faculty, f.name
        FROM public.faculty f
        JOIN public.career c ON f.id_faculty = c.faculty_fk
        JOIN public.student s ON s.career_fk = c.id_career
        JOIN public.student_status ss ON s.student_status_fk = ss.id_student_status
        WHERE c.cancelled = false
        AND c.faculty_fk IS NOT NULL
        AND ss.kind = 'Activo';
            `);
        const bulkOps = rows.map(row => ({
            updateOne: {
                filter: { sigenId: row.id_faculty.toString() },
                update: { name: row.name },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            try {
                await FacultyModel.bulkWrite(bulkOps, { ordered: false });
            } catch (error) {
                console.warn('Some faculties failed to migrate:', error);
            }
        }

        console.log(`${rows.length} Faculties processed successfully.`);
    },

    async migrateCourseTypes() {
        console.log('Migrating Course Types...');

        const rows = await DatabaseService.getRows('SELECT id_course_type, name FROM public.course_type');
        const bulkOps = rows.map(row => ({
            updateOne: {
                filter: { sigenId: row.id_course_type.toString() },
                update: { name: row.name },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            try {
                await CourseTypeModel.bulkWrite(bulkOps, { ordered: false });
            } catch (error) {
                console.warn('Some course types failed to migrate:', error);
            }
        }

        console.log(`${rows.length} Course Types processed successfully.`);
    },

    async migrateStudentStatuses() {
        console.log('Migrating Student Statuses...');
        const rows = await DatabaseService.getRows('SELECT id_student_status, kind FROM public.student_status');

        const bulkOps = rows.map(row => ({
            updateOne: {
                filter: { sigenId: row.id_student_status.toString() },
                update: { kind: row.kind },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            await StudentStatusModel.bulkWrite(bulkOps);
        }

        console.log(`${rows.length} Student Statuses processed successfully.`);
    },

    async migrateEvaluationValues() {
        console.log('Migrating Evaluation Values...');

        const rows = await DatabaseService.getRows('SELECT id_evaluation_value, value FROM public.evaluation_value');

        const bulkOps = rows.map(row => ({
            updateOne: {
                filter: { sigenId: row.id_evaluation_value.toString() },
                update: { value: row.value },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            try {
                await EvaluationValueModel.bulkWrite(bulkOps, { ordered: false });
            } catch (error) {
                console.warn('Some evaluation values failed to migrate:', error);
            }
        }

        console.log(`${rows.length} Evaluation Values processed successfully.`);
    },

    async migrateExaminationTypes() {
        console.log('Migrating Examination Types...');

        const rows = await DatabaseService.getRows('SELECT id_examination_type, name, priority FROM public.examination_type');

        const bulkOps = rows.map(row => ({
            updateOne: {
                filter: { sigenId: row.id_examination_type.toString() },
                update: { name: row.name, priority: row.priority },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            await ExaminationTypeModel.bulkWrite(bulkOps);
        }

        console.log(`${rows.length} Examination Types processed successfully.`);
    },

    async migrateCareers() {
        console.log('Migrating Careers...');

        const [faculties, courseTypes] = await Promise.all([
            FacultyModel.find({}, 'sigenId _id').lean(),
            CourseTypeModel.find({}, 'sigenId _id').lean()
        ]);

        const facultyMap = new Map(faculties.map(f => [f.sigenId, f._id]));
        const courseTypeMap = new Map(courseTypes.map(ct => [ct.sigenId || ct.sigenId, ct._id]));

        const rows = await DatabaseService.getRows(`
        SELECT DISTINCT ON (nc.name, c.faculty_fk, c.course_type_fk)
            c.id_career      AS id_career,
            nc.name          AS name,
            c.faculty_fk,
            c.course_type_fk
        FROM public.career c
        LEFT JOIN public.national_career nc
            ON c.national_career_fk = nc.id_national_career
        JOIN public.student s 
            ON s.career_fk = c.id_career
        JOIN public.student_status ss 
            ON s.student_status_fk = ss.id_student_status
        WHERE c.cancelled = false
            AND c.faculty_fk IS NOT NULL
            AND ss.kind = 'Activo' 
        ORDER BY nc.name, c.faculty_fk, c.course_type_fk, c.id_career;
    `);

        let bulkOps = [];
        let count = 0;
        let errors = 0;
        const batchSize = 1000;

        for (const row of rows) {
            const facultyId = facultyMap.get(String(row.faculty_fk));
            const courseTypeId = courseTypeMap.get(String(row.course_type_fk));

            if (!facultyId || !courseTypeId) {
                errors++;
                continue;
            }

            bulkOps.push({
                updateOne: {
                    filter: { sigenId: row.id_career.toString() },
                    update: {
                        name: row.name,
                        facultyId: facultyId,
                        courseTypeId: courseTypeId,
                    },
                    upsert: true
                }
            });

            if (bulkOps.length === batchSize) {
                await CareerModel.bulkWrite(bulkOps);
                count += bulkOps.length;
                bulkOps = [];
            }
        }

        if (bulkOps.length > 0) {
            await CareerModel.bulkWrite(bulkOps);
            count += bulkOps.length;
        }

        console.log(`Careers processed: ${count}. Errors/Skipped: ${errors}.`);
    },

    async migrateStudents() {
        console.log('Migrating Students...');

        const [careers, courseTypes, statuses] = await Promise.all([
            CareerModel.find({}, 'sigenId _id').lean(),
            CourseTypeModel.find({}, 'sigenId _id').lean(),
            StudentStatusModel.find({}, 'sigenId _id').lean()
        ]);

        const careerMap = new Map(careers.map(c => [c.sigenId, c._id]));
        const courseTypeMap = new Map(courseTypes.map(ct => [ct.sigenId, ct._id]));
        const statusMap = new Map(statuses.map(s => [s.sigenId, s._id]));

        const seenIdentifications = new Set();

        const rows = await DatabaseService.getRows(`
        SELECT
        s.id_student                                    AS id_student,
        s.name                                          AS first_name,
        CONCAT_WS(' ', s.middle_name, s.last_name)       AS last_name,
        s.identification,
        s.email,
        s.career_fk,
        s.course_type_fk,
        s.student_status_fk,
        MAX(sub.year)                                   AS academic_year
        FROM public.student s
        JOIN public.matriculated_subject ms
        ON ms.student_fk = s.id_student
        AND ms.cancelled = false
        LEFT JOIN public.subject sub
        ON ms.subject_fk = sub.subject_id
        JOIN public.career c
        ON s.career_fk = c.id_career
        WHERE s.student_status_fk IN ('02','03','04')
        AND c.faculty_fk IS NOT NULL
        GROUP BY
        s.id_student, s.name, s.middle_name, s.last_name, 
        s.identification, s.email, s.career_fk, 
        s.course_type_fk, s.student_status_fk
        HAVING MAX(sub.year) IS NOT NULL 
        AND MAX(sub.year) <> 0
        ORDER BY s.id_student;
    `);

        let bulkOps = [];
        let count = 0;
        let errors = 0;
        const batchSize = 1000;

        for (const row of rows) {
            const careerId = careerMap.get(String(row.career_fk));
            const courseTypeId = courseTypeMap.get(String(row.course_type_fk));
            const statusId = statusMap.get(String(row.student_status_fk));

            if (!careerId || !courseTypeId || !statusId) {
                errors++;
                continue;
            }

            if (seenIdentifications.has(row.identification)) {
                errors++;
                continue;
            }
            seenIdentifications.add(row.identification);

            bulkOps.push({
                updateOne: {
                    filter: { sigenId: row.id_student.toString() },
                    update: {
                        firstName: row.first_name,
                        lastName: row.last_name,
                        identification: row.identification,
                        email: row.email,
                        careerId: careerId,
                        courseTypeId: courseTypeId,
                        studentStatusId: statusId,
                        academicYear: row.academic_year,
                        isActive: true
                    },
                    upsert: true
                }
            });

            if (bulkOps.length === batchSize) {
                try {
                    await StudentModel.bulkWrite(bulkOps, { ordered: false });
                    count += bulkOps.length;
                } catch (err: any) {
                    errors += err.writeErrors ? err.writeErrors.length : 1;
                    count += (bulkOps.length - (err.writeErrors ? err.writeErrors.length : 1));
                }
                bulkOps = [];
            }
        }

        if (bulkOps.length > 0) {
            try {
                await StudentModel.bulkWrite(bulkOps, { ordered: false });
                count += bulkOps.length;
            } catch (err: any) {
                errors += err.writeErrors ? err.writeErrors.length : 1;
                count += (bulkOps.length - (err.writeErrors ? err.writeErrors.length : 1));
            }
        }

        console.log(`Students processed: ${count}. Errors/Skipped: ${errors}.`);
    },

    async migrateSubjects() {
        console.log('Migrating Subjects...');

        const careers = await CareerModel.find({}, 'sigenId _id').lean();
        const careerMap = new Map(careers.map(c => [c.sigenId, c._id]));

        const rows = await DatabaseService.getRows(`
        SELECT
            s.subject_id           AS subject_id,
            sn.name                AS name,
            d.career_fk            AS career_fk,
            s.year                 AS academic_year
        FROM public.subject s
        LEFT JOIN public.subject_name sn
        ON s.subject_name_fk = sn.subject_name_id
        LEFT JOIN public.discipline d
        ON s.discipline_fk = d.discipline_id
        JOIN public.career c
        ON d.career_fk = c.id_career
        WHERE s.cancelled = false
        AND s.year BETWEEN 1 AND 6
        AND d.career_fk IS NOT NULL
        AND c.faculty_fk IS NOT NULL;
    `);

        let bulkOps = [];
        let count = 0;
        let errors = 0;
        const batchSize = 1000;

        for (const row of rows) {
            const careerId = careerMap.get(String(row.career_fk));

            if (!careerId) {
                errors++;
                continue;
            }

            bulkOps.push({
                updateOne: {
                    filter: { sigenId: row.subject_id.toString() },
                    update: {
                        name: row.name,
                        careerId: careerId,
                        academicYear: row.academic_year
                    },
                    upsert: true
                }
            });

            if (bulkOps.length === batchSize) {
                try {
                    await SubjectModel.bulkWrite(bulkOps, { ordered: false });
                    count += bulkOps.length;
                } catch (err: any) {
                    const writeErrors = err.writeErrors ? err.writeErrors.length : 1;
                    errors += writeErrors;
                    count += (bulkOps.length - writeErrors);
                }
                bulkOps = [];
            }
        }

        if (bulkOps.length > 0) {
            try {
                await SubjectModel.bulkWrite(bulkOps, { ordered: false });
                count += bulkOps.length;
            } catch (err: any) {
                const writeErrors = err.writeErrors ? err.writeErrors.length : 1;
                errors += writeErrors;
                count += (bulkOps.length - writeErrors);
            }
        }

        console.log(`Subjects processed: ${count}. Errors/Skipped: ${errors}.`);
    },

    async migrateMatriculatedSubjects() {
        console.log('Migrating Matriculed Subjects...');

        const [students, subjects] = await Promise.all([
            StudentModel.find({}, 'sigenId _id').lean(),
            SubjectModel.find({}, 'sigenId _id').lean()
        ]);

        const studentMap = new Map(students.map(s => [s.sigenId, s._id]));
        const subjectMap = new Map(subjects.map(s => [s.sigenId, s._id]));

        const rows = await DatabaseService.getRows(`
        SELECT DISTINCT ON (ms.student_fk, ms.subject_fk)
        ms.matriculated_subject_id,
        ms.student_fk,
        ms.subject_fk,
        sub.year             AS academic_year,
        ms.evaluated
        FROM public.matriculated_subject ms
        JOIN public.student s
        ON ms.student_fk = s.id_student
        JOIN public.subject sub
        ON ms.subject_fk = sub.subject_id
        WHERE s.student_status_fk IN ('02','03','04')
        AND sub.cancelled = false
        AND ms.cancelled = false
        AND sub.year BETWEEN 1 AND 6
        ORDER BY ms.student_fk, ms.subject_fk, ms.matriculated_subject_id;
    `);

        let bulkOps = [];
        let count = 0;
        let errors = 0;
        const batchSize = 1000;

        for (const row of rows) {
            const studentId = studentMap.get(String(row.student_fk));
            const subjectId = subjectMap.get(String(row.subject_fk));

            if (!studentId || !subjectId) {
                errors++;
                continue;
            }

            bulkOps.push({
                updateOne: {
                    filter: { sigenId: row.matriculated_subject_id.toString() },
                    update: {
                        studentId,
                        subjectId,
                        academicYear: row.academic_year,
                        evaluated: !!row.evaluated
                    },
                    upsert: true
                }
            });

            if (bulkOps.length === batchSize) {
                try {
                    await MatriculatedSubjectModel.bulkWrite(bulkOps, { ordered: false });
                    count += bulkOps.length;
                } catch (err: any) {
                    errors += err.writeErrors ? err.writeErrors.length : 1;
                    count += (bulkOps.length - (err.writeErrors ? err.writeErrors.length : 1));
                }
                bulkOps = [];
            }
        }

        if (bulkOps.length > 0) {
            try {
                await MatriculatedSubjectModel.bulkWrite(bulkOps, { ordered: false });
                count += bulkOps.length;
            } catch (err: any) {
                errors += err.writeErrors ? err.writeErrors.length : 1;
                count += (bulkOps.length - (err.writeErrors ? err.writeErrors.length : 1));
            }
        }

        console.log(`Matricules processed: ${count}. Errors/Skipped: ${errors}.`);
    },

    async migrateEvaluations() {
        console.log('Migrating Evaluations...');

        const [students, matriculations, types, values] = await Promise.all([
            StudentModel.find({}, 'sigenId _id').lean(),
            MatriculatedSubjectModel.find({}, 'sigenId _id').lean(),
            ExaminationTypeModel.find({}, 'sigenId _id').lean(),
            EvaluationValueModel.find({}, 'sigenId _id').lean()
        ]);

        const studentMap = new Map(students.map(s => [s.sigenId, s._id]));
        const subjectMap = new Map(matriculations.map(m => [m.sigenId, m._id]));
        const typeMap = new Map(types.map(t => [t.sigenId, t._id]));
        const valueMap = new Map(values.map(v => [v.sigenId, v._id]));

        const rows = await DatabaseService.getRows(`
        SELECT id_evaluation, student_fk, matriculated_subject_fk, 
               evaluation_value_fk, examination_type_fk, 
               evaluation_date, registration_date  
        FROM public.evaluation
    `);

        let bulkOps = [];
        let count = 0;
        let errors = 0;
        const batchSize = 1000;

        for (const row of rows) {
            const studentId = studentMap.get(String(row.student_fk));
            const matriculatedId = subjectMap.get(String(row.matriculated_subject_fk));
            const examTypeId = typeMap.get(String(row.examination_type_fk));
            const valueId = valueMap.get(String(row.evaluation_value_fk));

            if (!studentId || !matriculatedId || !examTypeId || !valueId) {
                errors++;
                continue;
            }

            bulkOps.push({
                updateOne: {
                    filter: { sigenId: row.id_evaluation.toString() },
                    update: {
                        studentId,
                        matriculatedSubjectId: matriculatedId,
                        evaluationValueId: valueId,
                        examinationTypeId: examTypeId,
                        registrationDate: row.registration_date ? new Date(row.registration_date) : null,
                        evaluationDate: new Date(row.evaluation_date)
                    },
                    upsert: true
                }
            });

            if (bulkOps.length === batchSize) {
                await EvaluationModel.bulkWrite(bulkOps);
                count += bulkOps.length;
                bulkOps = [];
            }
        }

        if (bulkOps.length > 0) {
            await EvaluationModel.bulkWrite(bulkOps);
            count += bulkOps.length;
        }

        console.log(`Evaluations processed: ${count}. Errors/Skipped: ${errors}.`);
    }
};