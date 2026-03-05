import React, { useState, useEffect } from 'react';
import { Button, Row, Col } from 'antd';

const AirconCatalogPage = () => {
    const [aircons, setAircons] = useState([]);
    const [airconBrand, setAirconBrand] = useState('');
    const [airconModel, setAirconModel] = useState('');
    const [csvFile, setCsvFile] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const totalPages = Math.ceil(aircons.length / itemsPerPage);

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const resetForm = () => {
        setAirconBrand('');
        setAirconModel('');
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleAddAircon = async () => {
        try {
            const newAircon = { airconBrand, airconModel };

            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/aircon-catalogs/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newAircon),
            });

            if (response.ok) {
                console.log('Aircon entry added successfully');
                resetForm();
                await fetchAircons();
            } else {
                console.error('Failed to add aircon entry');
            }
        } catch (error) {
            console.error('Error adding aircon entry:', error);
        }
    };

    const handleDeleteAircon = async (id) => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api/aircon-catalogs/${id}/`, {
                method: 'DELETE',
            });

            if (response.ok) {
                console.log('Aircon entry deleted successfully');
                await fetchAircons();
            } else {
                console.error('Failed to delete aircon entry');
            }
        } catch (error) {
            console.error('Error deleting aircon entry:', error);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCsvFile(file);
        }
    };

    const handleBulkUpload = async () => {
        try {
            if (csvFile) {
                const formData = new FormData();
                formData.append('csvFile', csvFile);

                const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/aircon-catalogs/bulkCreate/`, {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    console.log('Bulk upload successful');
                    await fetchAircons();
                } else {
                    console.error('Failed to perform bulk upload');
                }
            } else {
                console.error('No CSV file selected for bulk upload');
            }
        } catch (error) {
            console.error('Error during bulk upload:', error);
        }
    };

    const fetchAircons = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/aircon-catalogs/`);
            if (response.ok) {
                let data = await response.json();
                // Apply the search filter to the entire dataset
                if (searchQuery) {
                    data = data.filter(aircon =>
                        aircon.airconBrand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        aircon.airconModel.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                }
                setAircons(data);
            } else {
                console.error('Failed to fetch aircons');
            }
        } catch (error) {
            console.error('Error fetching aircons:', error);
        }
    };

    useEffect(() => {
        fetchAircons();
    }, [searchQuery]);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-semibold mb-4">Aircon Catalog</h1>

            {/* Search box */}
            <div className="mb-4">
                <label htmlFor="searchQuery" className="mr-2 font-medium">
                    Search:
                </label>
                <input
                    type="text"
                    id="searchQuery"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="p-2 border border-gray-400 rounded mr-2"
                />
            </div>

            {/* Bulk Upload CSV */}
            <div className="mb-4">
                <label htmlFor="csvFile" className="mr-2 font-medium">
                    Upload CSV File:
                </label>
                <input
                    type="file"
                    id="csvFile"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="mr-2"
                />
                <button
                    type="button"
                    onClick={handleBulkUpload}
                    className="p-2 bg-green-500 text-white rounded"
                >
                    Bulk Upload
                </button>
            </div>

            {aircons.length === 0 && (
                <div className="text-center text-gray-600 mb-4">
                    No aircon models or brands available.
                </div>
            )}

            {/* Aircon Catalog Table */}
            {aircons.length > 0 && (
                <div className="mb-4">
                    <table className="min-w-full bg-white">
                        <thead className="bg-gray-800 text-white">
                        <tr>
                            <th className="w-1/2 px-4 py-2">Aircon Brand</th>
                            <th className="w-1/2 px-4 py-2">Aircon Model</th>
                            <th className="w-1/4 px-4 py-2">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {aircons
                            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                            .map((aircon, index) => (
                                <tr key={index} className="text-center border-b">
                                    <td className="px-4 py-2">{aircon.airconBrand}</td>
                                    <td className="px-4 py-2">{aircon.airconModel}</td>
                                    <td className="px-4 py-2">
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteAircon(aircon.id)}
                                            className="p-2 bg-red-500 text-white rounded"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Row justify="end" style={{ marginTop: '20px' }}>
                <Col>
                    <Button
                        type="primary"
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        style={{ backgroundColor: 'white', color: 'black', borderColor: 'blue' }}
                    >
                        Previous
                    </Button>
                    <Button
                        type="primary"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        style={{ marginLeft: '10px', backgroundColor: 'white', color: 'black', borderColor: 'blue' }}
                    >
                        Next
                    </Button>
                </Col>
            </Row>

            {/* Add Aircon Form */}
            <div className="mb-4">
                <label htmlFor="airconBrand" className="mr-2 font-medium">
                    Aircon Brand:
                </label>
                <input
                    type="text"
                    id="airconBrand"
                    value={airconBrand}
                    onChange={(e) => setAirconBrand(e.target.value)}
                    className="p-2 border border-gray-400 rounded mr-2"
                />

                <label htmlFor="airconModel" className="mr-2 font-medium">
                    Aircon Model:
                </label>
                <input
                    type="text"
                    id="airconModel"
                    value={airconModel}
                    onChange={(e) => setAirconModel(e.target.value)}
                    className="p-2 border border-gray-400 rounded mr-2"
                />

                <button
                    type="button"
                    onClick={handleAddAircon}
                    className="p-2 bg-blue-500 text-white rounded"
                >
                    Add Aircon
                </button>
            </div>
        </div>
    );
};

export default AirconCatalogPage;

