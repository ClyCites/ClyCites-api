import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

dummy_data = pd.read_csv('dummy_agricultural_data.csv')

dummy_data = pd.get_dummies(dummy_data, columns=['Climate Zone'])

features = ['Temperature (Celsius)', 'Precipitation (mm)', 'Soil pH', 'Input Expenses (Currency)',
            'Output Prices (Currency)', 'Climate Zone_Arctic', 'Climate Zone_Temperate', 'Climate Zone_Tropical']
target = 'Recommended Product'

X_train, X_test, y_train, y_test = train_test_split(dummy_data[features], dummy_data[target], test_size=0.2, random_state=42)

clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)

y_pred = clf.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)
print("Accuracy:", accuracy)
print("\nClassification Report:")
print(classification_report(y_test, y_pred))

import joblib
joblib.dump(clf, 'agricultural_product_recommendation_model.joblib')