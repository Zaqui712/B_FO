-- Create tables

CREATE TABLE Medicamento (
    medicamentoID INT IDENTITY NOT NULL,
    nomeMedicamento VARCHAR(255) NULL,
    dataValidade DATE NULL,
    tipoMedicamento VARCHAR(255) NULL,
    lote INT NULL,
    PRIMARY KEY (medicamentoID)
);

CREATE TABLE Fornecedor (
    fornecedorID INT IDENTITY NOT NULL,
    nomeFornecedor VARCHAR(30) NULL,
    contactoFornecedor INT NULL,
    emailFornecedor VARCHAR(100) NULL,
    PRIMARY KEY (fornecedorID)
);

CREATE TABLE Estado (
    estadoID INT IDENTITY NOT NULL,
    [Desc] VARCHAR(128) NULL,
    PRIMARY KEY (estadoID)
);

CREATE TABLE Credenciais (
    credenciaisID INT IDENTITY NOT NULL,
    email VARCHAR(128) NULL,
    password VARCHAR(128) NULL,
    PRIMARY KEY (credenciaisID)
);

CREATE TABLE Colaborador (
    colaboradorID INT IDENTITY NOT NULL,
    FornecedorfornecedorID INT NOT NULL,
    nomeProprio VARCHAR(30) NULL,
    apelido VARCHAR(50) NULL,
    CredenciaiscredenciaisID INT NOT NULL,
    PRIMARY KEY (colaboradorID)
);

-- Modified Encomenda table to include adminID as an attribute (not FK)
CREATE TABLE Encomenda (
    encomendaID INT IDENTITY NOT NULL,
    estadoID INT NOT NULL,  -- Changed from EstadoestadoID to estadoID to match second schema
    adminID INT NULL,   -- Added adminID as a regular attribute (not a FK)
    fornecedorID INT NOT NULL,  -- Keeping fornecedorID as in second schema
    encomendaCompleta BIT NULL,
    aprovadoPorAdministrador BIT NULL,
    dataEncomenda DATE NULL,
    dataEntrega DATE NULL,
    quantidadeEnviada INT NULL,  -- Added quantidadeEnviada to match second schema
    PRIMARY KEY (encomendaID)
);

CREATE TABLE Medicamento_Encomenda (
    MedicamentomedicamentoID INT NOT NULL,
    EncomendaencomendaID INT NOT NULL,
    PRIMARY KEY (MedicamentomedicamentoID, EncomendaencomendaID)
);

CREATE TABLE Medicamento_Fornecedor (
    MedicamentomedicamentoID INT NOT NULL,
    FornecedorfornecedorID INT NOT NULL,
    quantidadeDisponivel INT NULL,
    PRIMARY KEY (MedicamentomedicamentoID, FornecedorfornecedorID)
);

-- Create foreign key constraints to match the second schema
ALTER TABLE Medicamento_Encomenda 
    ADD CONSTRAINT FKMedicament342858 FOREIGN KEY (MedicamentomedicamentoID) 
    REFERENCES Medicamento (medicamentoID);

ALTER TABLE Medicamento_Encomenda 
    ADD CONSTRAINT FKMedicament950341 FOREIGN KEY (EncomendaencomendaID) 
    REFERENCES Encomenda (encomendaID);

ALTER TABLE Encomenda 
    ADD CONSTRAINT FKEncomenda985724 FOREIGN KEY (estadoID) 
    REFERENCES Estado (estadoID);  -- Changed from EstadoestadoID to estadoID

ALTER TABLE Encomenda 
    ADD CONSTRAINT FKEncomenda_Fornecedor FOREIGN KEY (fornecedorID) 
    REFERENCES Fornecedor (fornecedorID);  -- Updated foreign key reference
