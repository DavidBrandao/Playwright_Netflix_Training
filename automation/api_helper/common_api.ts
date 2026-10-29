async function deletarItem(id: number): Promise<void> {
    const response = await fetch(`https://api.exemplo.com/items/${id}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    
    const response = await fetch(`https://api.exemplo.com/items/${id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Erro ao deletar item: ${response.status}`);
    }

    console.log(`Item ${id} deletado com sucesso!`);
}
