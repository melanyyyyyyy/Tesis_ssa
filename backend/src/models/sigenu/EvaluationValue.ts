import { Schema, model, Document, Types } from 'mongoose';

export interface IEvaluationValue extends Document {
	_id: Types.ObjectId;
	sigenId: string;
	value: string;
}

const EvaluationValueSchema = new Schema<IEvaluationValue>(
	{
		sigenId: {
			type: String,
			index: true,
			required: true
		},
		value: {
			type: String,
			required: true,
			trim: true,
			maxlength: 50,
			index: true
		}
	},
	{
		timestamps: true,
		collection: 'evaluation_values',
		versionKey: false
	}
);

EvaluationValueSchema.methods.toJSON = function () {
	const obj = this.toObject();
	delete obj.sigenId;
	return obj;
};

export default model<IEvaluationValue>('EvaluationValue', EvaluationValueSchema);