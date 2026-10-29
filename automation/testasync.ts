// function buscarUsuario(): string {

//     let nome = ''

//     setTimeout(()=> {
//         nome = 'David'
//     }, 2000)

//     return nome
// }

function buscarUsuario(): Promise<string> {

    return new Promise((resolve) => {
        setTimeout(()=> resolve('David'), 2000)
    })

}


async function exibirUsuario(){

    console.log('Antes')
    console.log(await buscarUsuario())
    console.log('Depois')
}




exibirUsuario()