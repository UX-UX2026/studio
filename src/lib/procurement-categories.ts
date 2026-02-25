
export const procurementCategories = [
    "Operational Lease/Rental - SA",
    "Tech Support - SA",
    "ICT Maintenance - SA",
    "Software Licenses",
    "Hardware Purchase",
    "Office Supplies",
    "Consulting Services",
    "Connectivity",
    "IT Services",
    "IT Hardware",
    "Uncategorized",
].filter((value, index, self) => self.indexOf(value) === index).sort();
