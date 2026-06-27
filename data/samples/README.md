# Clean Smartwatch Health Dataset

## Overview

This dataset contains cleaned smartwatch health and activity tracking data collected from wearable devices. It includes key physiological and lifestyle metrics such as heart rate, blood oxygen level, step count, sleep duration, activity level, and stress level.

The dataset has been preprocessed to handle missing values and improve data quality, making it suitable for exploratory data analysis (EDA), machine learning projects, predictive modeling, and health analytics research.

## Data Cleaning Performed

- Removed the **User ID** column as it serves only as a unique identifier and does not contribute to predictive modeling.
- Filled missing values in **Heart Rate (BPM)** using the column mean.
- Filled missing values in **Blood Oxygen Level (%)** using the column mean.
- Verified that no missing values remain in the final dataset.
- Exported the cleaned dataset as a CSV file.

## Dataset Features

Feature

Description

Heart Rate (BPM)

Average heart rate measured in beats per minute

Blood Oxygen Level (%)

Blood oxygen saturation percentage (SpO₂)

Step Count

Total number of steps recorded

Sleep Duration (hours)

Number of hours slept

Activity Level

Categorized physical activity level

Stress Level

Categorized stress level

## Dataset Shape

- Rows: _Update after upload_
- Columns: 6

## Potential Use Cases

- Health Data Analysis
- Wearable Device Analytics
- Lifestyle Pattern Analysis
- Stress Level Prediction
- Sleep Pattern Analysis
- Activity Level Classification
- Machine Learning Projects
- Data Visualization and Dashboard Development

## Recommended Machine Learning Tasks

### Classification

- Predict Activity Level
- Predict Stress Level

### Regression

- Predict Heart Rate (BPM)
- Predict Sleep Duration (hours)

### Clustering

- Group users based on health and activity patterns

## Sample Python Code

    import pandas as pd

    df = pd.read_csv("clean_smartwatch_health_data.csv")

    print(df.head())
    print(df.info())

## Data Quality

- No missing values
- Cleaned numerical features
- Ready for EDA and machine learning workflows
- CSV format for easy integration with Python, R, SQL, and BI tools

## License

This dataset is intended for educational, research, and machine learning purposes.

## Acknowledgements

Thanks to the original dataset creator and the open data community for making health and wearable-device datasets available for learning and experimentation.
