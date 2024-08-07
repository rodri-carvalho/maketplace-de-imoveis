import { collection, doc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase.config";
import Spinner from "./Spinner";
import { Navigation, Pagination, Scrollbar, A11y } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/scrollbar";
import "swiper/css/a11y";

function Slider() {
	const [loading, setLoading] = useState(null);
	const [listings, setListings] = useState(null);

	const navigate = useNavigate();

	useEffect(() => {
		const fetchListings = async () => {
			const listingsRef = collection(db, "listings");
			const q = query(listingsRef, orderBy("timestamp", "desc"), limit(5));
			const querySnap = await getDocs(q);

			let listings = [];

			querySnap.forEach((doc) => {
				return listings.push({
					id: doc.id,
					data: doc.data(),
				});
			});

			setListings(listings);
			setLoading(false);
		};

		fetchListings();
	}, []);

	if (loading) {
		return <Spinner />;
	}

	if (!listings || listings.length === 0) {
		return <></>;
	}

	return (
		listings && (
			<>
				<p className="exploreHeading" style={{ fontSize: "20px" }}>
					Recommendados
				</p>
				<Swiper
					modules={[Navigation, Pagination, Scrollbar, A11y]}
					slidesPerView={1}
					pagination={{ clickable: true }}
					navigation
					style={{ height: "380px" }}>
					{listings.map(({ data, id }) => {
						return (
							<SwiperSlide key={id} onClick={() => navigate(`/category/${data.type}/${id}`)}>
								<div
									className="swiperSlideDiv"
									style={{
										background: `url(${data.imgUrls[0]}) center no-repeat`,
										backgroundSize: "cover",
									}}>
									<p className="swiperSlideText" style={{ marginTop: "170px" }}>
										{data.name}
									</p>
									<p className="swiperSlidePrice" style={{ marginTop: "165px" }}>
										R${" "}
										{data.discountedPrice ??
											data.regularPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}{" "}
										{data.type === "rent" && "por mês"}
									</p>
								</div>
							</SwiperSlide>
						);
					})}
				</Swiper>
			</>
		)
	);
}

export default Slider;
