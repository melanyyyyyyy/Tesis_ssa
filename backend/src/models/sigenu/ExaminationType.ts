import { Schema, model, Document, Types } from 'mongoose';

export interface IExaminationType extends Document {
	_id: Types.ObjectId;
	sigenId: string;
	name: string;
	priority?: number;
}

const ExaminationTypeSchema = new Schema<IExaminationType>(
	{
		sigenId: {
			type: String,
			index: true,
			required: true
		},
		name: {
			type: String,
			required: true,
			trim: true,
			maxlength: 200,
			index: true
		},
		priority: {
			type: Number
		}
	},
	{
		timestamps: true,
		collection: 'examination_types',
		versionKey: false
	}
);

ExaminationTypeSchema.methods.toJSON = function () {
	const obj = this.toObject();
	delete obj.sigenId;
	return obj;
};

export default model<IExaminationType>('ExaminationType', ExaminationTypeSchema);