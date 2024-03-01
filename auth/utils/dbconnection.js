const uri = '';

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});

// Event listeners
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
  });
  
  mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
  });
  
  mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    mongoose.connection.close(() => {
      console.log('Mongoose connection disconnected through app termination');
      process.exit(0);
    });
  });
  
