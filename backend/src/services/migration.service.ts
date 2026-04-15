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
import { RoleModel, UserModel } from '../models/system/index.js'

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

    getWriteErrorCount(error: any) {
        return error?.writeErrors?.length || 1;
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
                console.warn(`Some faculties failed to migrate. Write errors: ${this.getWriteErrorCount(error)}`);
            }
        }

        console.log(`${rows.length} Faculties processed successfully.`);
    },

    async migrateCourseTypes() {
        console.log('Migrating Course Types...');

        const rows = await DatabaseService.getRows(`
        SELECT 
            id_course_type, 
            name 
        FROM public.course_type 
        WHERE name IN ('Curso Diurno', 'Curso por Encuentros');
        `);
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
                console.warn(`Some course types failed to migrate. Write errors: ${this.getWriteErrorCount(error)}`);
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
                console.warn(`Some evaluation values failed to migrate. Write errors: ${this.getWriteErrorCount(error)}`);
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
        JOIN public.course_type ct
            ON c.course_type_fk = ct.id_course_type
        WHERE c.cancelled = false
            AND c.faculty_fk IS NOT NULL
            AND ss.kind = 'Activo' 
            AND ct.name IN ('Curso Diurno', 'Curso por Encuentros')
        ORDER BY nc.name, c.faculty_fk, c.course_type_fk, c.id_career;
    `);

        let bulkOps = [];
        let count = 0;
        let missingReferences = 0;
        let writeErrors = 0;
        const batchSize = 1000;

        for (const row of rows) {
            const facultyId = facultyMap.get(String(row.faculty_fk));
            const courseTypeId = courseTypeMap.get(String(row.course_type_fk));

            if (!facultyId || !courseTypeId) {
                missingReferences++;
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
                try {
                    await CareerModel.bulkWrite(bulkOps, { ordered: false });
                    count += bulkOps.length;
                } catch (error: any) {
                    const currentWriteErrors = this.getWriteErrorCount(error);
                    writeErrors += currentWriteErrors;
                    count += (bulkOps.length - currentWriteErrors);
                }
                bulkOps = [];
            }
        }

        if (bulkOps.length > 0) {
            try {
                await CareerModel.bulkWrite(bulkOps, { ordered: false });
                count += bulkOps.length;
            } catch (error: any) {
                const currentWriteErrors = this.getWriteErrorCount(error);
                writeErrors += currentWriteErrors;
                count += (bulkOps.length - currentWriteErrors);
            }
        }

        console.log(`Careers processed: ${count}. Missing references: ${missingReferences}. Write errors: ${writeErrors}.`);
    },

    async migrateStudents() {
        console.log('Migrating Students...');

        const [careers, courseTypes, statuses, studentRole] = await Promise.all([
            CareerModel.find({}, 'sigenId _id').lean(),
            CourseTypeModel.find({}, 'sigenId _id').lean(),
            StudentStatusModel.find({}, 'sigenId _id').lean(),
            RoleModel.findOne({ name: 'student' })
        ]);

        if (!studentRole) {
            console.error('Error: Student role not found in database.');
            return;
        }

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
    JOIN public.course_type ct
        ON s.course_type_fk = ct.id_course_type
    WHERE s.student_status_fk = '02'
        AND c.faculty_fk IS NOT NULL
        AND ct.name IN ('Curso Diurno', 'Curso por Encuentros')
    GROUP BY
        s.id_student, s.name, s.middle_name, s.last_name, 
        s.identification, s.email, s.career_fk, 
        s.course_type_fk, s.student_status_fk
    HAVING MAX(sub.year) IS NOT NULL 
    AND MAX(sub.year) <> 0
    ORDER BY s.id_student;
    `);

        let studentBulkOps = [];
        let count = 0;
        let missingReferences = 0;
        let duplicateIdentifications = 0;
        let studentWriteErrors = 0;
        let userWriteErrors = 0;
        const batchSize = 500;

        for (const row of rows) {
            const careerId = careerMap.get(String(row.career_fk));
            const courseTypeId = courseTypeMap.get(String(row.course_type_fk));
            const statusId = statusMap.get(String(row.student_status_fk));

            if (!careerId || !courseTypeId || !statusId || seenIdentifications.has(row.identification)) {
                if (seenIdentifications.has(row.identification)) {
                    duplicateIdentifications++;
                } else {
                    missingReferences++;
                }
                continue;
            }

            seenIdentifications.add(row.identification);

            studentBulkOps.push({
                updateOne: {
                    filter: { sigenId: row.id_student.toString() },
                    update: {
                        firstName: row.first_name,
                        lastName: row.last_name,
                        identification: row.identification,
                        ...(row.email && { email: row.email }),
                        careerId: careerId,
                        courseTypeId: courseTypeId,
                        studentStatusId: statusId,
                        academicYear: row.academic_year,
                        isActive: true
                    },
                    upsert: true
                }
            });

            if (studentBulkOps.length === batchSize) {
                const batchResult = await this.executeBatch(studentBulkOps, studentRole._id);
                count += batchResult.persistedStudents;
                studentWriteErrors += batchResult.studentWriteErrors;
                userWriteErrors += batchResult.userWriteErrors;
                studentBulkOps = [];
            }
        }

        if (studentBulkOps.length > 0) {
            const batchResult = await this.executeBatch(studentBulkOps, studentRole._id);
            count += batchResult.persistedStudents;
            studentWriteErrors += batchResult.studentWriteErrors;
            userWriteErrors += batchResult.userWriteErrors;
        }

        console.log(`Students processed: ${count}. Missing references: ${missingReferences}. Duplicate identifications: ${duplicateIdentifications}. Student write errors: ${studentWriteErrors}. User write errors: ${userWriteErrors}.`);
    },

    async executeBatch(studentOps: any[], roleId: any) {
        let studentWriteErrors = 0;
        let userWriteErrors = 0;

        try {
            await StudentModel.bulkWrite(studentOps, { ordered: false });
        } catch (err) {
            studentWriteErrors = this.getWriteErrorCount(err);
            console.warn(`Student batch completed with write errors: ${studentWriteErrors}.`);
        }

        const sigenIds = studentOps.map(op => op.updateOne.filter.sigenId);
        const savedStudents = await StudentModel.find(
            { sigenId: { $in: sigenIds } },
            '_id identification firstName lastName email'
        ).lean();

        const userBulkOps = savedStudents.map(student => ({
            updateOne: {
                filter: { identification: student.identification },
                update: {
                    firstName: student.firstName,
                    lastName: student.lastName,
                    identification: student.identification,
                    ...(student.email && { email: student.email }),
                    roleId: roleId,
                    studentId: student._id,
                    isActive: false
                },
                upsert: true
            }
        }));

        if (userBulkOps.length > 0) {
            try {
                await UserModel.bulkWrite(userBulkOps, { ordered: false });
            } catch (err) {
                userWriteErrors = this.getWriteErrorCount(err);
                console.warn(`User batch completed with write errors: ${userWriteErrors}.`);
            }
        }

        return {
            persistedStudents: savedStudents.length,
            studentWriteErrors,
            userWriteErrors
        };
    },

    async migrateSubjects() {
        console.log('Migrating Subjects...');

        const careers = await CareerModel.find({}, 'sigenId _id').lean();
        const careerMap = new Map(careers.map(c => [c.sigenId, c._id]));

        const rows = await DatabaseService.getRows(`
        SELECT DISTINCT
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
        JOIN public.matriculated_subject ms
            ON ms.subject_fk = s.subject_id
        JOIN public.student stu
            ON ms.student_fk = stu.id_student
        JOIN public.course_type ct
            ON stu.course_type_fk = ct.id_course_type
        WHERE s.cancelled = false               
            AND ms.cancelled = false            
            AND s.year BETWEEN 1 AND 6          
            AND d.career_fk IS NOT NULL         
            AND c.faculty_fk IS NOT NULL        
            AND stu.student_status_fk = '02'
            AND ct.name IN ('Curso Diurno', 'Curso por Encuentros');
    `);

        let bulkOps = [];
        let count = 0;
        let missingReferences = 0;
        let writeErrors = 0;
        const batchSize = 1000;

        for (const row of rows) {
            const careerId = careerMap.get(String(row.career_fk));

            if (!careerId) {
                missingReferences++;
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
                    const currentWriteErrors = this.getWriteErrorCount(err);
                    writeErrors += currentWriteErrors;
                    count += (bulkOps.length - currentWriteErrors);
                }
                bulkOps = [];
            }
        }

        if (bulkOps.length > 0) {
            try {
                await SubjectModel.bulkWrite(bulkOps, { ordered: false });
                count += bulkOps.length;
            } catch (err: any) {
                const currentWriteErrors = this.getWriteErrorCount(err);
                writeErrors += currentWriteErrors;
                count += (bulkOps.length - currentWriteErrors);
            }
        }

        console.log(`Subjects processed: ${count}. Missing references: ${missingReferences}. Write errors: ${writeErrors}.`);
    },

    async migrateMatriculatedSubjects() {
        console.log('Migrating Matriculed Subjects...');
        const stageStartedAt = Date.now();

        const referencesStartedAt = Date.now();
        const [students, subjects] = await Promise.all([
            StudentModel.find({}, 'sigenId _id').lean(),
            SubjectModel.find({}, 'sigenId _id').lean()
        ]);
        console.log(`[Matriculated Subjects] Reference documents loaded in ${Date.now() - referencesStartedAt} ms. Students: ${students.length}. Subjects: ${subjects.length}.`);

        const studentMap = new Map(students.map(s => [s.sigenId, s._id]));
        const subjectMap = new Map(subjects.map(s => [s.sigenId, s._id]));

        console.log('[Matriculated Subjects] Fetching rows from PostgreSQL...');
        const queryStartedAt = Date.now();
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
        JOIN public.career c
            ON s.career_fk = c.id_career
        JOIN public.course_type ct
            ON c.course_type_fk = ct.id_course_type
        WHERE s.student_status_fk = '02'
            AND sub.cancelled = false
            AND ms.cancelled = false
            AND sub.year BETWEEN 1 AND 6
            AND ct.name IN ('Curso Diurno', 'Curso por Encuentros')
        ORDER BY ms.student_fk, ms.subject_fk, ms.matriculated_subject_id;
    `);
        console.log(`[Matriculated Subjects] PostgreSQL rows fetched in ${Date.now() - queryStartedAt} ms. Rows: ${rows.length}.`);

        let bulkOps = [];
        let count = 0;
        let missingReferences = 0;
        let writeErrors = 0;
        const batchSize = 1000;
        let scannedRows = 0;
        let executedBatches = 0;

        for (const row of rows) {
            scannedRows++;
            const studentId = studentMap.get(String(row.student_fk));
            const subjectId = subjectMap.get(String(row.subject_fk));

            if (!studentId || !subjectId) {
                missingReferences++;
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
                const batchStartedAt = Date.now();
                try {
                    await MatriculatedSubjectModel.bulkWrite(bulkOps, { ordered: false });
                    count += bulkOps.length;
                } catch (err: any) {
                    const currentWriteErrors = this.getWriteErrorCount(err);
                    writeErrors += currentWriteErrors;
                    count += (bulkOps.length - currentWriteErrors);
                }
                executedBatches++;
                if (executedBatches % 10 === 0) {
                    console.log(`[Matriculated Subjects] Batch ${executedBatches} completed in ${Date.now() - batchStartedAt} ms. Scanned: ${scannedRows}/${rows.length}. Inserted/Updated: ${count}. Missing references: ${missingReferences}. Write errors: ${writeErrors}. Elapsed: ${Date.now() - stageStartedAt} ms.`);
                }
                bulkOps = [];
            }
        }

        if (bulkOps.length > 0) {
            const batchStartedAt = Date.now();
            try {
                await MatriculatedSubjectModel.bulkWrite(bulkOps, { ordered: false });
                count += bulkOps.length;
            } catch (err: any) {
                const currentWriteErrors = this.getWriteErrorCount(err);
                writeErrors += currentWriteErrors;
                count += (bulkOps.length - currentWriteErrors);
            }
            executedBatches++;
            console.log(`[Matriculated Subjects] Final batch ${executedBatches} completed in ${Date.now() - batchStartedAt} ms. Scanned: ${scannedRows}/${rows.length}. Inserted/Updated: ${count}. Missing references: ${missingReferences}. Write errors: ${writeErrors}. Elapsed: ${Date.now() - stageStartedAt} ms.`);
        }

        console.log(`Matricules processed: ${count}. Missing references: ${missingReferences}. Write errors: ${writeErrors}. Total elapsed: ${Date.now() - stageStartedAt} ms.`);
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
        SELECT 
            e.id_evaluation, 
            e.student_fk, 
            e.matriculated_subject_fk, 
            e.evaluation_value_fk, 
            e.examination_type_fk, 
            e.evaluation_date, 
            e.registration_date
        FROM public.evaluation e
        JOIN public.student s 
            ON e.student_fk = s.id_student
        JOIN public.matriculated_subject ms 
            ON e.matriculated_subject_fk = ms.matriculated_subject_id
        JOIN public.subject sub 
            ON ms.subject_fk = sub.subject_id
        JOIN public.career c 
            ON s.career_fk = c.id_career
        JOIN public.course_type ct 
            ON c.course_type_fk = ct.id_course_type
        WHERE 
            s.student_status_fk = '02'
            AND sub.cancelled = false
            AND sub.year BETWEEN 1 AND 6
            AND ct.name IN ('Curso Diurno', 'Curso por Encuentros')
            AND e.cancelled = false
            AND ms.cancelled = false;
    `);

        let bulkOps = [];
        let count = 0;
        let missingReferences = 0;
        let writeErrors = 0;
        const batchSize = 1000;

        for (const row of rows) {
            const studentId = studentMap.get(String(row.student_fk));
            const matriculatedId = subjectMap.get(String(row.matriculated_subject_fk));
            const examTypeId = typeMap.get(String(row.examination_type_fk));
            const valueId = valueMap.get(String(row.evaluation_value_fk));

            if (!studentId || !matriculatedId || !examTypeId || !valueId) {
                missingReferences++;
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
                try {
                    await EvaluationModel.bulkWrite(bulkOps, { ordered: false });
                    count += bulkOps.length;
                } catch (err: any) {
                    const currentWriteErrors = this.getWriteErrorCount(err);
                    writeErrors += currentWriteErrors;
                    count += (bulkOps.length - currentWriteErrors);
                }
                bulkOps = [];
            }
        }

        if (bulkOps.length > 0) {
            try {
                await EvaluationModel.bulkWrite(bulkOps, { ordered: false });
                count += bulkOps.length;
            } catch (err: any) {
                const currentWriteErrors = this.getWriteErrorCount(err);
                writeErrors += currentWriteErrors;
                count += (bulkOps.length - currentWriteErrors);
            }
        }

        console.log(`Evaluations processed: ${count}. Missing references: ${missingReferences}. Write errors: ${writeErrors}.`);
    }
};
