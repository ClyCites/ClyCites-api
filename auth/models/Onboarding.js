const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Step1Schema = new Schema({
  field1: {
    type: String,
    required: true,
  },
  field2: {
    type: String,
    required: true,
  },
});

const Step2Schema = new Schema({
  field3: {
    type: String,
    required: true,
  },
  field4: {
    type: String,
    required: true,
  },
});

const onboardingSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  step: {
    type: Number,
    required: true,
  },
  details: {
    type: Schema.Types.Mixed,
    required: true,
  },
}, { timestamps: true });

const Onboarding = mongoose.model('Onboarding', onboardingSchema);

module.exports = Onboarding;
module.exports.Step1Schema = Step1Schema;
module.exports.Step2Schema = Step2Schema;
