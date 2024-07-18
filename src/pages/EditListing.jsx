import { useState, useEffect, useRef } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.config";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import Spinner from "../components/Spinner";

function EditListing() {
	const [geolocationEnabled, setGeolocationEnabled] = useState(true);
	const [loading, setLoading] = useState(false);
	const [listing, setListing] = useState(false);
	const [formData, setFormData] = useState({
		type: "rent",
		name: "",
		bedrooms: 1,
		bathrooms: 1,
		parking: false,
		furnished: false,
		address: "",
		offer: false,
		regularPrice: 0,
		discountedPrice: 0,
		images: {},
		latitude: 0,
		longitude: 0,
	});

	const {
		type,
		name,
		bedrooms,
		bathrooms,
		parking,
		furnished,
		address,
		offer,
		regularPrice,
		discountedPrice,
		images,
		latitude,
		longitude,
	} = formData;

	const auth = getAuth();
	const navigate = useNavigate();
	const isMounted = useRef(true);
	const params = useParams();

	useEffect(() => {
		if (listing && listing.userRef !== auth.currentUser.uid) {
			toast.error("Você não pode editar este anúncio");
			navigate("/");
		}
	});

	useEffect(() => {
		setLoading(true);
		const fetchListing = async () => {
			const docRef = doc(db, "listings", params.listingId);
			const docSnap = await getDoc(docRef);
			if (docSnap.exists()) {
				setListing(docSnap.data());
				setFormData({ ...docSnap.data(), address: docSnap.data().location });
				setLoading(false);
			} else {
				navigate("/");
				toast.error("Anúncio inexistente");
			}
		};

		fetchListing();
	}, [params.listingId, navigate]);

	useEffect(() => {
		if (isMounted) {
			onAuthStateChanged(auth, (user) => {
				if (user) {
					setFormData({ ...formData, userRef: user.uid });
				} else {
					navigate("/sign-in");
				}
			});
		}
		return () => {
			isMounted.current = false;
		};
		//eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isMounted]);

	const onSubmit = async (e) => {
		e.prevent.default();

		setLoading(true);

		if (discountedPrice >= regularPrice) {
			setLoading(false);
			toast.error("O valor com desconto deve ser menor que o valor normal");
			return;
		}

		if (images.length > 6) {
			setLoading(false);
			toast.error("Máximo de 6 imagens");
			return;
		}

		let geolocation = {};
		let location;

		if (geolocationEnabled) {
			const response = await fetch(
				`https://maps.googleapis.com/maps/api/geocode/json?adress=${address}&key=${
					import.meta.env.VITE_REACT_APP_GEOCODE_API_KEY
				}`
			);

			const data = await response.json();

			geolocation.lat = data.results[0]?.geometry.location.lat ?? 0;
			geolocation.lng = data.results[0]?.geometry.location.lng ?? 0;

			location = data.status === "ZERO_RESULTS" ? undefined : data.results[0]?.formatted_address;

			if (location === undefined || location.includes("undefined")) {
				setLoading(false);
				toast.error("Por favor, insira o endereço correto");
			}
		} else {
			geolocation.lat = latitude;
			geolocation.lng = longitude;
		}

		const storeImage = async (image) => {
			return new Promise((resolve, reject) => {
				const storage = getStorage();
				const fileName = `${auth.currentUser.uid}-${image.name}-${uuidv4()}`;

				const storageRef = ref(storage, "images/" + fileName);

				const uploadTask = uploadBytesResumable(storageRef, image);

				uploadTask.on(
					"state_changed",
					(snapshot) => {
						const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
						console.log("Upload is " + progress + "% done");
						switch (snapshot.state) {
							case "paused":
								console.log("Upload is paused");
								break;
							case "running":
								console.log("Upload is running");
								break;
							default:
								break;
						}
					},
					(error) => {
						reject(error);
					},
					() => {
						getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
							resolve(downloadURL);
						});
					}
				);
			});
		};

		const imgUrls = await Promise.all([...images].map((image) => storeImage(image))).catch(() => {
			setLoading(false);
			toast.error("Imagens não foram subidas");
			return;
		});

		const formDataCopy = {
			...formData,
			imgUrls,
			geolocation,
			timestamp: serverTimestamp(),
		};

		formDataCopy.location = address;
		delete formDataCopy.images;
		delete formDataCopy.address;
		!formDataCopy.offer && delete formDataCopy.discountedPrice;

		const docRef = doc(db, "listings", params.listingId);
		await updateDoc(docRef, formDataCopy);
		setLoading(false);
		toast.success("Anúncio criado");
		navigate(`/category/${formDataCopy.type}/${docRef.id}`);

		setLoading(false);
	};

	const onMutate = (e) => {
		let boolean = null;

		if (e.target.value === "true") {
			boolean = true;
		}
		if (e.target.value === "false") {
			boolean = false;
		}

		//Files
		if (e.target.files) {
			setFormData((prevState) => ({
				...prevState,
				images: e.target.files,
			}));
		}

		//Text/Booleans/Numbers
		if (!e.target.files) {
			setFormData((prevState) => ({
				...prevState,
				[e.target.id]: boolean ?? e.target.value,
			}));
		}
	};

	if (loading) {
		return <Spinner />;
	}

	return (
		<div className="profile">
			<header>
				<p className="pageHeader">Editar anúncio</p>
			</header>

			<main>
				<form onSubmit={onSubmit}>
					<label htmlFor="" className="formLabel">
						Vender/Alugar
					</label>
					<div className="formButtons">
						<button
							type="button"
							className={type === "sale" ? "formButtonActive" : "formButton"}
							id="type"
							value="sale"
							onClick={onMutate}>
							Vender
						</button>
						<button
							type="button"
							className={type === "rent" ? "formButtonActive" : "formButton"}
							id="type"
							value="rent"
							onClick={onMutate}>
							Alugar
						</button>
					</div>

					<label className="formLabel">Name</label>
					<input
						className="formInputName"
						type="text"
						id="name"
						value={name}
						onChange={onMutate}
						maxLength="32"
						minLength="10"
						required
					/>

					<div className="formRooms flex">
						<div>
							<label className="formLabel">Bedrooms</label>
							<input
								className="formInputSmall"
								type="number"
								id="bedrooms"
								value={bedrooms}
								onChange={onMutate}
								min="1"
								max="50"
								required
							/>
						</div>
						<div>
							<label className="formLabel">Bathrooms</label>
							<input
								className="formInputSmall"
								type="number"
								id="bathrooms"
								value={bathrooms}
								onChange={onMutate}
								min="1"
								max="50"
								required
							/>
						</div>
					</div>

					<label className="formLabel">Parking spot</label>
					<div className="formButtons">
						<button
							className={parking ? "formButtonActive" : "formButton"}
							type="button"
							id="parking"
							value={true}
							onClick={onMutate}
							min="1"
							max="50">
							Yes
						</button>
						<button
							className={!parking && parking !== null ? "formButtonActive" : "formButton"}
							type="button"
							id="parking"
							value={false}
							onClick={onMutate}>
							No
						</button>
					</div>

					<label className="formLabel">Furnished</label>
					<div className="formButtons">
						<button
							className={furnished ? "formButtonActive" : "formButton"}
							type="button"
							id="furnished"
							value={true}
							onClick={onMutate}>
							Yes
						</button>
						<button
							className={!furnished && furnished !== null ? "formButtonActive" : "formButton"}
							type="button"
							id="furnished"
							value={false}
							onClick={onMutate}>
							No
						</button>
					</div>

					<label className="formLabel">Address</label>
					<textarea
						className="formInputAddress"
						type="text"
						id="address"
						value={address}
						onChange={onMutate}
						required
					/>

					{!geolocationEnabled && (
						<div className="formLatLng flex">
							<div>
								<label className="formLabel">Latitude</label>
								<input
									className="formInputSmall"
									type="number"
									id="latitude"
									value={latitude}
									onChange={onMutate}
									required
								/>
							</div>
							<div>
								<label className="formLabel">Longitude</label>
								<input
									className="formInputSmall"
									type="number"
									id="longitude"
									value={longitude}
									onChange={onMutate}
									required
								/>
							</div>
						</div>
					)}

					<label className="formLabel">Offer</label>
					<div className="formButtons">
						<button
							className={offer ? "formButtonActive" : "formButton"}
							type="button"
							id="offer"
							value={true}
							onClick={onMutate}>
							Yes
						</button>
						<button
							className={!offer && offer !== null ? "formButtonActive" : "formButton"}
							type="button"
							id="offer"
							value={false}
							onClick={onMutate}>
							No
						</button>
					</div>

					<label className="formLabel">Regular Price</label>
					<div className="formPriceDiv">
						<input
							className="formInputSmall"
							type="number"
							id="regularPrice"
							value={regularPrice}
							onChange={onMutate}
							min="50"
							max="750000000"
							required
						/>
						{type === "rent" && <p className="formPriceText">$ / Month</p>}
					</div>

					{offer && (
						<>
							<label className="formLabel">Discounted Price</label>
							<input
								className="formInputSmall"
								type="number"
								id="discountedPrice"
								value={discountedPrice}
								onChange={onMutate}
								min="50"
								max="750000000"
								required={offer}
							/>
						</>
					)}

					<label className="formLabel">Images</label>
					<p className="imagesInfo">The first image will be the cover (max 6).</p>
					<input
						className="formInputFile"
						type="file"
						id="images"
						onChange={onMutate}
						max="6"
						accept=".jpg,.png,.jpeg"
						multiple
						required
					/>
					<button type="submit" className="primaryButton createListingButton">
						Editar anúncio
					</button>
				</form>
			</main>
		</div>
	);
}

export default EditListing;
