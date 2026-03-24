# imports
import base64
import os
import streamlit as st
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv2D, BatchNormalization, MaxPooling2D, Flatten, Dense, Dropout
from tensorflow.keras.preprocessing.image import load_img, img_to_array
import numpy as np
from io import BytesIO  # moved import to top


# load css
def load_local_css(file_name):
    try:
        with open(file_name) as f:
            st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)
    except FileNotFoundError:
        st.warning(f"CSS file not found: {file_name}")

load_local_css("./styles/style.css")


# bootstrap
st.markdown(
    """<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">""",
    unsafe_allow_html=True
)

# load model weights
@st.cache_resource
def load_models():
    weight_path = os.path.join("CNN_model_weight", "model_weights.weights.h5")
    if not os.path.exists(weight_path):
        st.error(f"Model weights not found at: {os.path.abspath(weight_path)}")
        return None
    return weight_path

# Access cached models
cnn_model = load_models()

# CNN model
def run_cnn(img_arr):
    my_model = Sequential()
    my_model.add(Conv2D(
            filters=16, 
            kernel_size=(3, 3), 
            strides=(1, 1),
            activation='relu',
            input_shape=(256, 256, 3) 
    ))
    my_model.add(BatchNormalization())
    my_model.add(MaxPooling2D())
    
    my_model.add(Conv2D(filters=32, kernel_size=(3, 3), activation='relu')) 
    my_model.add(BatchNormalization())
    my_model.add(MaxPooling2D()) 

    my_model.add(Conv2D(filters=64, kernel_size=(3, 3), activation='relu')) 
    my_model.add(BatchNormalization())
    my_model.add(MaxPooling2D())
    
    my_model.add(Flatten())
    my_model.add(Dense(512, activation='relu')) 
    my_model.add(Dropout(0.09)) 
    my_model.add(Dense(1, activation='sigmoid'))
    my_model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

    if not cnn_model:
        st.error("CNN weights are not available. Please check the model path.")
        return None

    try:
        my_model.load_weights(cnn_model)
    except Exception as e:
        st.error(f"Failed to load CNN weights: {e}")
        return None

    try:
        prediction = my_model.predict(img_arr)
    except Exception as e:
        st.error(f"Prediction failed: {e}")
        return None

    return prediction

# preprocess image for cnn
def pre_process_img(image_file):
        try:
            input_picture = load_img(image_file, target_size=(256, 256))
        except Exception as e:
            st.error(f"Failed to load image: {e}")
            return None
        img_arr = img_to_array(input_picture) / 255.0  # Normalize the image
        img_arr = img_arr.reshape((1, 256, 256, 3))  # Add batch dimension
        result = run_cnn(img_arr)
        return result


#UI

#title
col1, col2, col3,col4, col5 = st.columns([4,1,3,3,1],  gap="small")

with col1:
    st.write('')
with col2:
    st.image("styles/robot.png")
with col3:
    st.markdown(
        """
        <p class="title"> AI vs REAL Image Detection </p>
        """,
        unsafe_allow_html=True
    )
with col4:
    st.write('')
with col5:
    st.write('')

# division between photo and other widget component
main_col_one, main_col_two = st.columns([2,2], gap="large")
#photo column
with main_col_one:
    # Create a placeholder for the image
    image_placeholder = st.empty()

with main_col_two:
    try:
        with open("styles/detectiveMag.svg", "r") as file:
            svg_content_detective_Mag = file.read()
    except FileNotFoundError:
        svg_content_detective_Mag = ""
        st.warning("SVG file styles/detectiveMag.svg not found.")

    #alignment between magnifying glass image and upload line
    col1, col2, col3,col4 = st.columns([4,4,1,3],  gap="small")
    with col1:
        st.write('')
    with col2:
        st.markdown(
            """<p class = "upload_line"> Please upload the image </p>""",
            unsafe_allow_html= True
        )
    with col3:
        if svg_content_detective_Mag:
            st.markdown(
                f"<div class='detectiveMag1' style='bottom: 0%; right: 0%;'>{svg_content_detective_Mag}</div>",
                unsafe_allow_html=True
            )
    with col4:
        st.write('')


                
    # introduce states
    if "prev_image" not in st.session_state:
        st.session_state.prev_image = None 

    # Upload image widget
    user_image = st.file_uploader("png, jpg, or jpeg image", ['png', 'jpg', 'jpeg'], label_visibility='hidden')

    if user_image:
        # Cache raw bytes so we don't call read() twice
        image_bytes = user_image.read()
        st.session_state.prev_image = image_bytes

        # Convert the image to base64 encoding
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')

        # Display the image centered using HTML
        image_placeholder.markdown(
            f'<div style="display: flex; justify-content: center;">'
            f'<img src="data:image/jpeg;base64,{image_base64}" max-width:"100%" height:"auto"/>'
            f'</div>',
            unsafe_allow_html=True
        )

    # placeholder to display result
    result_placeholder = st.empty()

# Use the uploaded image for prediction
if st.session_state.get("prev_image") is not None:
    print('CNN is running')

    # Re-wrap the bytes in a BytesIO for Keras loader
    img_file_obj = BytesIO(st.session_state.prev_image)

    predictions = pre_process_img(img_file_obj)

    if predictions is None:
        # Error already shown above
        pass
    else:
        try:
            score = float(predictions[0][0])
            result_word = "AI Generated" if score < 0.5 else "REAL"

            result_placeholder.markdown(
                f"<div class='result'> <span class = 'prediction'>Prediction: {score:.2%}</span> <br> It is a <span class = resultword> {result_word} </span> image. </div>",
                unsafe_allow_html=True
            )
            print(predictions[0])
        except Exception as e:
            st.error(f"Unexpected prediction format: {e}")



