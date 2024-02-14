import pandas as pd
import numpy as np

# Generate dummy data for agricultural factors
def generate_dummy_data(num_samples=1000):
    np.random.seed(42)
    # Weather and climatic conditions
    temperature = np.random.uniform(15, 35, num_samples)  # Temperature in Celsius
    precipitation = np.random.uniform(0, 100, num_samples)  # Precipitation in mm

    # Soil structure
    soil_ph = np.random.uniform(4, 8.5, num_samples)  # Soil pH

    # Climate
    climate_zones = np.random.choice(['Tropical', 'Temperate', 'Arctic'], num_samples)

    # Input and output expenses
    input_expenses = np.random.uniform(1000, 5000, num_samples)  # Input expenses in currency
    output_prices = np.random.uniform(5000, 10000, num_samples)  # Output prices in currency

    # Agricultural products
    products = np.random.choice(['Wheat', 'Corn', 'Rice', 'Soybeans', 'Potatoes'], num_samples)

    data = {
        'Temperature (Celsius)': temperature,
        'Precipitation (mm)': precipitation,
        'Soil pH': soil_ph,
        'Climate Zone': climate_zones,
        'Input Expenses (Currency)': input_expenses,
        'Output Prices (Currency)': output_prices,
        'Recommended Product': products
    }
    return pd.DataFrame(data)

# Generate dummy dataset
dummy_data = generate_dummy_data()

# Display the first few rows of the dummy dataset
print(dummy_data.head())

# Save dummy data to a CSV file
dummy_data.to_csv('dummy_agricultural_data.csv', index=False)
